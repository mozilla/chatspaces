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
    user.recent(req, function (err, chats) {
      if (err) {
        res.status(400);
        res.json({
          message: err.toString()
        });
      } else {
        var notificationKey = 'notification:' + req.session.userHash + ':' + req.params.userHash;
        redisClient.del(notificationKey);
        redisClient.lrem('notifications:' + req.session.userHash, 0, notificationKey);

        res.json({
          chats: chats.chats
        });
      }
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
    var newChat;
    var sendToUser = function (sender, receiver, message, chat, callback) {
      user.sendMessage(sender, receiver, message, chat, function (err, n) {
        if (err) {
          console.log(err);
        } else {
          newChat = n;
          callback(null, true);
        }
      });
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
        recipients: recipients
      };

      if (recipients.length < 1) {
        res.status(400);
        res.json({
          message: 'you need to send to at least 1 person'
        });
      } else {

        var sendNotifications = function (recipient) {
          user.sendNotification(req, recipient, io, newChat, function (err, notification) {
            var notificationKey = 'notification:' + recipient + ':' + req.session.userHash;
            redisClient.hmset(notificationKey, {
              username: req.session.username,
              userHash: req.session.userHash
            });
            redisClient.expire(notificationKey, TTL_LIMIT);

            var notificationListKey = 'notifications:' + recipient;
            redisClient.lpush(notificationListKey, notificationKey);
            redisClient.expire(notificationListKey, TTL_LIMIT);

            io.sockets.in(recipient).emit('notification', {
              notification: notification
            });
          });
        };

        sendToUser(req.session.userHash, req.session.userHash, req.body.message, chat, function (err) {
          if (err) {
            console.log(err);
          } else {
            recipients.forEach(function (recipient) {
              if (recipient !== req.session.userHash) {
                sendToUser(recipient, req.session.userHash, req.body.message, chat, function (err) {
                  if (err) {
                    console.log(err);
                  } else {

                    sendNotifications(recipient);
                  }
                });
              }
            });
          }
        });

        res.json({
          message: 'done'
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
          redisClient.hgetall(n, function (err, notification) {
            if (!err && notification) {
              console.log('sending notification ', notification)
              io.sockets.in(req.session.userHash).emit('notification', {
                notification: {
                  username: notification.username,
                  userHash: notification.userHash,
                  senderUserHash: notification.userHash
                }
              });
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
