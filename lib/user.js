'use strict';

var crypto = require('crypto');
var level = require('level');
var nconf = require('nconf');

var Jamon = require('meatspace-jamon');
var jamon = {};

nconf.argv().env().file({ file: 'local.json' });

var usernamesDb = level(nconf.get('db') + '/usernames', {
  createIfMissing: true,
  valueEncoding: 'json'
});

var setUser = function (userHash) {
  if (!jamon[userHash]) {
    jamon[userHash] = new Jamon(userHash, {
      db: nconf.get('db') + '/users/' + userHash,
      limit: 20
    });
  }
};

exports.getUsername = function (req, callback) {
  setUser(req.session.userHash);

  usernamesDb.get('email!' + req.session.email, function (err, username) {
    if (err) {
      callback(err);
    } else {
      callback(null, username);
    }
  });
};

exports.setUserHash = function (email) {
  return crypto.createHash('md5').update(email).digest('hex');
};

exports.gravatarUrl = function (userHash) {
  return 'http://www.gravatar.com/avatar/' + userHash + '?s=80';
};

exports.getProfile = function (req, callback) {
  usernamesDb.get('email!' + req.session.email, function (err, username) {
    if (!username) {
      callback({
        email: req.session.email,
        gravatar: exports.gravatarUrl(req.session.userHash)
      });
    } else {
      callback(null, username);
    }
  });
};

exports.getBlockedUsers = function (req, io) {
  jamon[req.session.userHash].getBlockedUsers(function (err, users) {
    if (err) {
      throw new Error('Could not get blocked users');
    } else {
      try {
        users.blocked.forEach(function (u) {
          usernamesDb.get('userHash!' + u.key, function (err, username) {
            if (err) {
              console.error(err);
            } else {
              io.sockets.in(req.session.userHash).emit('blocked', {
                user: {
                  username: username,
                  userHash: u.key,
                  avatar: exports.gravatarUrl(u.key)
                }
              });
            }
          });
        });
      } catch (e) { }
    }
  });
};

exports.block = function (req, callback) {
  jamon[req.session.userHash].blockUser(req.body.userHash, function (err) {
    if (err) {
      callback(err);
    } else {
      callback(null, 'blocked user');
    }
  });
};

exports.unblock = function (req, callback) {
  jamon[req.session.userHash].unblockUser(req.params.userHash, function (err) {
    if (err) {
      callback(err);
    } else {
      callback(null, 'unblocked user');
    }
  });
};

exports.follow = function (req, io, callback) {
  jamon[req.session.userHash].follow(req.body.userHash, function (err, user) {
    if (err) {
      callback(err);
    } else {
      usernamesDb.get('userHash!' + user, function (err, username) {
        if (!err) {
          setUser(user);

          jamon[user].follow(req.session.userHash, function (err) {
            if (err) {
              console.error(err);
            } else {

              io.sockets.in(req.session.userHash).emit('friend', {
                friend: {
                  username: username,
                  userHash: user,
                  avatar: exports.gravatarUrl(user)
                }
              });

              io.sockets.in(user).emit('friend', {
                friend: {
                  username: req.session.username,
                  userHash: req.session.userHash,
                  avatar: exports.gravatarUrl(req.session.userHash)
                }
              });
            }
          });
        }
      });

      callback(null, 'followed');
    }
  });
};

exports.unfollow = function (req, callback) {
  jamon[req.session.userHash].unfollow(req.params.userHash, function (err, status) {
    if (err) {
      callback(err);
    } else {
      callback(null, status);
    }
  });
};

exports.getFollowing = function (req, io) {
  jamon[req.session.userHash].getFollowing(function (err, users) {
    if (err) {
      throw new Error('Could not get your followed users');
    } else {
      try {
        users.followed.forEach(function (f) {
          usernamesDb.get('userHash!' + f.key, function (err, username) {
            if (!err) {
              io.sockets.in(req.session.userHash).emit('friend', {
                friend: {
                  username: username,
                  userHash: f.key,
                  avatar: exports.gravatarUrl(f.key)
                }
              });
            }
          });
        });
      } catch (e) { }
    }
  });
};

exports.recent = function (req, io) {
  var sinceId = false;

  if (req.query.since) {
    sinceId = req.query.since + '~';
  }

  jamon[req.session.userHash].getChats(sinceId, false, function (err, chats) {
    if (!err) {
      try {
        chats.chats.forEach(function (chat) {
          io.sockets.in(req.session.userHash).emit('message', {
            key: chat.key,
            value: chat.value
          });
        });
      } catch (e) { }
    }
  });
};

exports.getThread = function (req, io) {
  jamon[req.session.userHash].getThread(req.params.senderKey, req.query.since || false, false, function (err, chats) {
    if (!err && typeof chats.chats === 'object') {
      try {
        chats.chats.forEach(function (chat) {
          io.sockets.in(req.session.userHash).emit('message', {
            key: chat.key,
            value: chat.value
          });
        });
      } catch (e) { }
    }
  });
};

exports.search = function (keyword, callback) {
  var users = [];

  usernamesDb.createReadStream({

    start: 'username!' + keyword,
    end: 'username!' + keyword + '\xff'
  }).on('data', function (data) {

    users.push({
      username: data.key.split('!')[1],
      avatar: exports.gravatarUrl(data.value),
      userHash: data.value
    });
  }).on('error', function (err) {

    callback(err);
  }).on('end', function () {

    callback(null, users);
  });
};

exports.sendMessage = function (sender, receiver, message, chat, io, callback) {
  setUser(receiver);
  setUser(sender);

  jamon[sender].addChat(receiver, message, chat, function (err, n) {
    if (err) {
      callback(err);
    } else {
      callback(null, n);

      if (n.reply) {
        io.sockets.in(sender).emit('message', {
          key: n.senderKey,
          value: n
        });
      } else {
        io.sockets.in(receiver).emit('message', {
          key: n.senderKey,
          value: n
        });
      }
    }
  });
};

exports.sendNotification = function (req, recipient, io, newChat, callback) {
  setUser(recipient);

  usernamesDb.get('userHash!' + recipient, function (err, u) {
    if (!err) {
      io.sockets.in(recipient).emit('message', {
        key: newChat.senderKey,
        value: newChat
      });

      callback(null, newChat.reply || newChat.senderKey);
    }
  });
};

exports.updateProfile = function (req, username, callback) {
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
          callback(err);
        } else {

          callback(null, true);
        }
      });
    } else {
      callback(new Error('username taken'));
    }
  });
};
