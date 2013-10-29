'use strict';

module.exports = function(app, io, nconf, parallax, usernamesDb, crypto, isLoggedIn) {
  var gravatarUrl = function (userHash) {
    return 'http://www.gravatar.com/avatar/' + userHash + '?s=80';
  }

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

  app.get('/api/friend/:username', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].getOrAddFriend(req.params.username, function (err, user) {
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
        var friends = [];

        users.friends.forEach(function (f) {
          usernamesDb.get('username!' + f.key, function (err, userHash) {
            if (!err) {
              io.sockets.in(req.session.userHash).emit('friend', {
                friend: {
                  username: f.key,
                  avatar: gravatarUrl(userHash)
                }
              });
            }
          });
        });
      }
    });
  });

  app.get('/api/messages/:username', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].getChats(req.params.username, false, true, function (err, chats) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not retrieve messages'
        });
      } else {
        console.log(chats)
        res.json({
          chats: chats
        });
      }
    });
  });

  app.post('/api/friend', isLoggedIn, function (req, res) {
    parallax[req.session.userHash].getOrAddFriend(req.body.username, function (err, user) {
      if (err) {
        res.status(400);
        res.json({
          message: 'could not send friend request'
        });
      } else {
        usernamesDb.get('username!' + user.user, function (err, userHash) {
          console.log(err, userHash)
          if (!err) {
            console.log('adding to friend side');
            if (!parallax[userHash]) {
              parallax[userHash] = new Parallax(userHash, {
                db: nconf.get('db') + '/users/' + userHash
              });
            }

            parallax[userHash].getOrAddFriend(req.session.username, function (err, sender) {
              console.log('sending to both')
              if (!err) {
                io.sockets.in(req.session.userHash).emit('friend', {
                  friend: {
                    username: user.user,
                    avatar: gravatarUrl(userHash)
                  }
                });

                io.sockets.in(userHash).emit('friend', {
                  friend: {
                    username: sender.user,
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
          avatar: gravatarUrl(data.value)
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
    if (!req.body.message) {
      res.status(400);
      res.json({
        message: 'message cannot be empty'
      });
    } else {
      var recipients = req.body.recipients;

      recipients.forEach(function (recipient) {
        parallax[req.session.userHash].addChat(recipient, req.body.message, {
          ttl: false,
          media: req.body.picture,
          recipients: recipients
        }, function (err, chat) {
          if (err) {
            console.log('error ', err);
          } else {
            usernamesDb.get('username!' + recipient, function (err, email) {
              if (!err) {
                console.log('sending socket response to ', email)
                io.sockets.in(crypto.createHash('md5').update(email).digest('hex')).emit('message', {
                  chats: chat
                });
              }
            });
          }
        });
      });

      res.json({
        message: 'done'
      });
    }
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

      usernamesDb.get('username!' + username, function (err, u) {
        if (err || !u) {
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
          if (username === req.session.username) {
            res.json({
              username: username
            });
            return;
          } else {
            res.status(400);
            res.json({
              message: 'username taken'
            });
          }
        }
      });
    }
  });

  app.get('/*', function (req, res) {
    res.render('index');
  });
};
