'use strict';

module.exports = function (app, io, nconf, user, redisClient, isLoggedIn) {
  var TTL_LIMIT = 86400; // 1 day

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.get('/api/profile', isLoggedIn, function (req, res) {
    user.getProfile(req, function (newUser, username) {
      if (newUser) {
        console.log('username not found, redirect to profile page');
        res.json(newUser);
      } else {
        req.session.username = username;

        res.json({
          email: req.session.email,
          username: username,
          gravatar: user.gravatarUrl(req.session.userHash),
          userHash: req.session.userHash
        });
      }
    });
  });

  app.get('/api/blocked', isLoggedIn, function (req, res) {
    user.getBlockedUsers(req, io);
  });

  app.post('/api/block', isLoggedIn, function (req, res) {
    user.block(req, function (err, status) {
      if (err) {
        res.status(400);
        res.json({
          message: err.toString()
        });
      } else {
        res.json({
          message: status
        });
      }
    });
  });

  app.del('/api/block/:userHash', isLoggedIn, function (req, res) {
    user.unblock(req, function (err, status) {
      if (err) {
        res.status(400);
        res.json({
          message: err.toString()
        });
      } else {
        res.json({
          message: status
        });
      }
    });
  });

  app.post('/api/follow', isLoggedIn, function (req, res) {
    user.follow(req, io, function (err, status) {
      if (err) {
        res.status(400);
        res.json({
          message: err.toString()
        });
      } else {
        res.json({
          message: status
        });
      }
    });
  });

  app.del('/api/unfollow/:userHash', isLoggedIn, function (req, res) {
    user.unfollow(req, function (err, status) {
      if (err) {
        res.status(400);
        res.json({
          message: err.toString()
        });
      } else {
        res.json({
          message: status
        });
      }
    });
  });

  app.get('/api/following', isLoggedIn, function (req, res) {
    user.getFollowing(req, io);
  });

  app.get('/api/feed', isLoggedIn, function (req, res) {
    user.recent(req, io);

    res.json({
      message: 'received feed'
    });
  });

  app.get('/api/thread/:senderKey', isLoggedIn, function (req, res) {
    user.getThread(req, io);
    redisClient.lrem('notifications:' + req.session.userHash, 0, 'notification:' + req.params.senderKey);
    redisClient.del(req.params.senderKey);

    res.json({
      message: 'received thread'
    });
  });

  app.post('/api/search', isLoggedIn, function (req, res) {
    if (!req.body.username) {
      res.status(400);
      res.json({
        message: 'username cannot be empty'
      });
    } else {
      user.search(req.body.username, function (err, users) {
        if (err) {
          res.status(400);
          res.json({
            message: err.toString()
          });
        } else {
          res.json({
            users: users
          });
        }
      });
    }
  });

  app.post('/api/message', isLoggedIn, function (req, res) {
    console.log(req.body.recipients)
    var sendToUser = function (sender, receiver, message, chat, callback) {
      user.sendMessage(sender, receiver, message, chat, io, callback);
    };

    if (!req.body.message) {
      res.status(400);
      res.json({
        message: 'message cannot be empty'
      });
    } else {
      var recipients = req.body.recipients;

      var chat = {
        media: req.body.picture,
        recipients: recipients,
        reply: req.body.reply || ''
      };

      if (recipients.length < 1) {
        res.status(400);
        res.json({
          message: 'you need to send to at least 1 person'
        });
      } else {

        var sendNotifications = function (recipient, newChat, mainKey) {
          user.sendNotification(req, recipient, io, newChat, function (err, notification) {
            var notificationKey = 'notification:' + mainKey;
            redisClient.set(notificationKey, mainKey);
            redisClient.expire(notificationKey, TTL_LIMIT);

            var notificationListKey = 'notifications:' + recipient;
            redisClient.lpush(notificationListKey, 'notification:' + mainKey);
            redisClient.expire(notificationListKey, TTL_LIMIT);

            io.sockets.in(recipient).emit('notification', mainKey);
          });
        };

        sendToUser(req.session.userHash, req.session.userHash, req.body.message, chat, function (err, newChat) {
          if (err) {
            res.status(400);
            res.json({
              message: err.toString()
            });
          } else {
            var mainKey = newChat.reply || newChat.senderKey;

            recipients.forEach(function (recipient) {
              if (recipient !== req.session.userHash) {
                console.log('sending to recipient ', recipient)
                chat.created = newChat.created;
                chat.senderKey = newChat.senderKey;

                sendToUser(recipient, req.session.userHash, req.body.message, chat, function (err) {

                  if (!err) {
                    sendNotifications(recipient, newChat, mainKey);
                  }
                });
              }
            });

            res.json({
              key: mainKey
            });
          }
        });
      }
    }
  });

  // Right now this only loads the notification state if the user is on the page and logged in.
  // What we want to do eventually is call this from the client-side if the device is allowed to
  // receive notifications, without having the app stay open.
  app.get('/api/notifications', isLoggedIn, function (req, res) {
    redisClient.lrange('notifications:' + req.session.userHash, 0, -1, function (err, notifications) {
      if (!err && notifications) {
        notifications.forEach(function (n) {
          redisClient.get(n, function (err, notification) {
            if (!err && notification) {
              console.log('sending notification ', notification)
              io.sockets.in(req.session.userHash).emit('notification', notification);
            }
          });
        });

        res.json({
          message: 'notifications sent'
        });
      }
    });
  });

  app.put('/api/profile', isLoggedIn, function (req, res) {
    var username = '';

    if (req.body.username) {
      username = req.body.username.toString().toLowerCase().replace(/[^\w+$]/gi, '');
    }

    if (username.length < 1) {
      res.status(400);
      res.json({
        message: 'username is invalid'
      });
    } else {

      if (username === req.session.username) {
        res.json({
          username: username,
          message: 'no change'
        });
        return;
      }

      user.updateProfile(req, username, function (err, status) {
        if (err) {
          res.status(400);
          res.json({
            message: err.toString()
          });
        } else {
          req.session.username = username;

          res.json({
            username: username,
            message: 'updated username'
          });
        }
      });
    }
  });

  app.get('/api/logout', function (req, res) {
    req.session.reset();

    res.json({
      message: 'logged out'
    });
  });

  app.get('/*', function (req, res) {
    res.render('index');
  });
};
