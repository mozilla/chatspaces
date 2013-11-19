'use strict';

module.exports = function (app, io, nconf, parallax, usernamesDb, crypto, Parallax, redisClient, isLoggedIn) {
  var gravatarUrl = function (userHash) {
    return 'http://www.gravatar.com/avatar/' + userHash + '?s=80';
  };

  var TTL_LIMIT = 86400; // 1 day

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.get('/api/profile', isLoggedIn, function (req, res) {
    usernamesDb.get('email!' + req.session.email, function (err, username) {
      if (err) {
        console.log('username not found, redirect to profile page');

        res.json({
          email: req.session.email,
          gravatar: gravatarUrl(req.session.userHash)
        });
      } else {
        req.session.username = username;

        res.json({
          email: req.session.email,
          username: username,
          gravatar: gravatarUrl(req.session.userHash),
          userHash: req.session.userHash
        });
      }
    });
  });

  app.get('/api/blocked', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].getBlockedUsers(function (err, users) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not get blocked users'
        });
      } else {
        try {
          users.blocked.forEach(function (user) {
            usernamesDb.get('userHash!' + user.key, function (err, username) {
              if (err) {
                console.error(err);
              } else {
                io.sockets.in(req.session.userHash).emit('blocked', {
                  user: {
                    username: username,
                    userHash: user.key,
                    avatar: gravatarUrl(user.key)
                  }
                });
              }
            });
          });
        } catch (e) {
          console.error(e);
        }

        res.json({
          message: 'loading blocked users'
        });
      }
    });
  });

  app.post('/api/block', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].blockUser(req.body.userHash, function (err) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not block user'
        });
      } else {
        res.json({
          message: 'blocked user'
        });
      }
    });
  });

  app.del('/api/block/:userHash', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].unblockUser(req.params.userHash, function (err) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not unblock user'
        });
      } else {
        res.json({
          message: 'unblocked user'
        });
      }
    });
  });

  app.get('/api/friend/:userHash', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].getOrAddFriend(req.params.userHash, function (err, user) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not send friend request or find friend'
        });
      } else {
        res.json({
          user: user
        });
      }
    });
  });

  app.get('/api/friends', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].getFriends(function (err, users) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not send friend request'
        });
      } else {
        try {
          users.friends.forEach(function (f) {
            usernamesDb.get('userHash!' + f.key, function (err, username) {
              if (!err) {
                io.sockets.in(req.session.userHash).emit('friend', {
                  friend: {
                    username: username,
                    userHash: f.key,
                    avatar: gravatarUrl(f.key),
                    unread: 0
                  }
                });
              }
            });
          });
        } catch (e) {
          console.error(e);
        }
      }
    });
  });

  app.get('/api/messages/:userHash', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].getChats(req.params.userHash, false, true, function (err, chats) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not retrieve messages'
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

  app.post('/api/friend', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].getOrAddFriend(req.body.userHash, function (err, user) {
      if (err) {

        res.status(400);
        res.json({
          message: 'could not send friend request'
        });
      } else {

        usernamesDb.get('userHash!' + user.user, function (err, username) {
          if (!err) {
            if (!parallax[user.user]) {
              parallax[user.user] = new Parallax(user.user, {
                db: nconf.get('db') + '/users/' + user.user
              });
            }

            parallax[user.user].getOrAddFriend(req.session.userHash, function (err) {
              if (err) {
                res.status(400);
                res.json({
                  message: 'error adding friend'
                });
              } else {
                io.sockets.in(req.session.userHash).emit('friend', {
                  friend: {
                    username: username,
                    userHash: user.user,
                    avatar: gravatarUrl(user.user)
                  }
                });

                io.sockets.in(user.user).emit('friend', {
                  friend: {
                    username: req.session.username,
                    userHash: req.session.userHash,
                    avatar: gravatarUrl(req.session.userHash)
                  }
                });

                res.json({
                  message: 'added friend!'
                });
              }
            });
          }
        });
      }
    });
  });

  app.del('/api/friend/:userHash', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].removeUser(req.params.userHash, function (err) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not delete user'
        });
      } else {
        res.json({
          message: 'deleted user'
        });
      }
    });
  });

  app.del('/api/message/:userHash/:key', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].removeChat(req.params.userHash, req.params.key, function (err) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not delete chat'
        });
      } else {
        res.json({
          message: 'deleted chat'
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
      var users = [];

      usernamesDb.createReadStream({

        start: 'username!' + req.body.username,
        end: 'username!' + req.body.username + '\xff'
      }).on('data', function (data) {

        users.push({
          username: data.key.split('!')[1],
          avatar: gravatarUrl(data.value),
          userHash: data.value
        });
      }).on('error', function (err) {

        res.status(400);
        res.json({
          message: err.toString()
        });
      }).on('end', function () {

        res.json({
          users: users
        });
      });
    }
  });

  app.post('/api/message', isLoggedIn, function (req, res) {
    var newChat;
    var sendToUser = function (sender, receiver, message, chat, callback) {
      if (!parallax[receiver]) {
        parallax[receiver] = new Parallax(receiver, {
          db: nconf.get('db') + '/users/' + receiver
        });
      }

      parallax[sender].addChat(receiver, message, chat, function (err, n) {
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
        media: req.body.picture || '/images/no-image.png',
        recipients: recipients
      };

      if (recipients.length < 1) {
        res.status(400);
        res.json({
          message: 'you need to send to at least 1 friend'
        });
      } else {

        var sendNotifications = function (recipient) {
          parallax[recipient].hasFriend(req.session.userHash, function (err) {
            if (!err) {
              usernamesDb.get('userHash!' + recipient, function (err, u) {
                if (!err) {
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
                    notification: {
                      username: u,
                      userHash: recipient,
                      senderUserHash: req.session.userHash
                    }
                  });

                  io.sockets.in(recipient).emit('message', {
                    key: newChat.senderKey,
                    value: newChat
                  });
                }
              });
            }
          });
        };

        recipients.forEach(function (recipient) {
          sendToUser(req.session.userHash, recipient, req.body.message, chat, function (err) {
            if (err) {
              console.log(err);
            } else {
              if (recipient !== req.session.userHash) {
                sendToUser(recipient, req.session.userHash, req.body.message, chat, function (err) {
                  if (err) {
                    console.log(err);
                  } else {

                    sendNotifications(recipient);
                  }
                });
              }
            }
          });
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

      usernamesDb.get('username!' + username, function (err, userHash) {
        if (err || !userHash) {

          var opts = [
            {
              type: 'del',
              key: 'username!' + req.session.username
            },
            {
              type: 'put',
              key: 'email!' + req.session.email,
              value: username
            },
            {
              type: 'put',
              key: 'userHash!' + req.session.userHash,
              value: username
            },
            {
              type: 'put',
              key: 'username!' + username,
              value: req.session.userHash
            }
          ];

          usernamesDb.batch(opts, function (err) {
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
        } else {
          res.status(400);
          res.json({
            message: 'username taken'
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
