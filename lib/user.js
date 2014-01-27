'use strict';

var crypto = require('crypto');
var level = require('level');
var nconf = require('nconf');
var through2 = require('through2');
var concat = require('concat-stream');

var Jamon = require('meatspace-jamon');
var jamon = {};

nconf.argv().env().file({ file: 'local.json' });

var DEFAULT_AVATAR = '/images/avatar.gif';

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

exports.getProfile = function (req, callback) {
  usernamesDb.get('email!' + req.session.email, function (err, username) {
    usernamesDb.get('avatar!' + req.session.userHash, function (err, avatar) {
      avatar = avatar || DEFAULT_AVATAR;

      if (!username) {
        callback({
          email: req.session.email,
          avatar: avatar
        });
      } else {
        callback(null, username, avatar);
      }
    });
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
              usernamesDb.get('avatar!' + u.key, function (avatar) {
                io.sockets.in(req.session.userHash).emit('blocked', {
                  user: {
                    username: username,
                    userHash: u.key,
                    avatar: avatar || DEFAULT_AVATAR
                  }
                });
              });
            }
          });
        });
      } catch (e) {
        console.log('Blocked list is empty');
      }
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

              usernamesDb.get('avatar!' + user, function (avatar) {
                io.sockets.in(req.session.userHash).emit('friend', {
                  friend: {
                    username: username,
                    userHash: user,
                    avatar: avatar || DEFAULT_AVATAR
                  }
                });
              });

              usernamesDb.get('avatar!' + req.session.userHash, function (avatar) {
                io.sockets.in(user).emit('friend', {
                  friend: {
                    username: req.session.username,
                    userHash: req.session.userHash,
                    avatar: avatar || DEFAULT_AVATAR
                  }
                });
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
              usernamesDb.get('avatar!' + f.key, function (err, avatar) {
                if (err || !avatar) {
                  avatar = DEFAULT_AVATAR;
                }

                io.sockets.in(req.session.userHash).emit('friend', {
                  friend: {
                    username: username,
                    userHash: f.key,
                    avatar: avatar
                  }
                });
              });
            }
          });
        });
      } catch (e) {
        console.error('Following is empty');
      }
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
          var recipientAvatars = [];
          var count = 0;

          chat.value.recipients.forEach(function (r) {
            usernamesDb.get('avatar!' + r, function (err, avatar) {
              if (!err && avatar) {
                recipientAvatars.push(avatar);
              } else {
                recipientAvatars.push(DEFAULT_AVATAR);
              }

              if (count === chat.value.recipients.length - 1) {
                chat.value.recipientAvatars = recipientAvatars;
                io.sockets.in(req.session.userHash).emit('message', {
                  key: chat.key,
                  value: chat.value
                });
              }

              count ++;
            });
          });
        });
      } catch (e) {
        console.error('Chat is empty');
      }
    }
  });
};

exports.getThread = function (req, io) {
  jamon[req.session.userHash].getThread(req.params.senderKey, req.query.since || false, false, function (err, chats) {
    if (!err && typeof chats.chats === 'object') {
      try {
        chats.chats.forEach(function (chat) {
          var recipientAvatars = [];
          var count = 0;

          chat.value.recipients.forEach(function (r) {
            usernamesDb.get('avatar!' + r, function (err, avatar) {
              if (!err && avatar) {
                recipientAvatars.push(avatar);
              } else {
                recipientAvatars.push(DEFAULT_AVATAR);
              }

              if (count === chat.value.recipients.length - 1) {
                chat.value.recipientAvatars = recipientAvatars;
                io.sockets.in(req.session.userHash).emit('message', {
                  key: chat.key,
                  value: chat.value
                });
              }

              count ++;
            });
          });
        });
      } catch (e) {
        console.error('Thread is empty');
      }
    }
  });
};

exports.search = function (keyword, callback) {
  var rs = usernamesDb.createReadStream({
    start: 'username!' + keyword,
    end: 'username!' + keyword + '\xff'
  });

  rs.pipe(through2({ objectMode: true }, function (data, encoding, callback) {
    var self = this;
    usernamesDb.get('avatar!' + data.value, function (err, avatar) {
      if (err || !avatar) {
        avatar = DEFAULT_AVATAR;
      }

      self.push({
        username: data.key.split('!')[1],
        avatar: avatar,
        userHash: data.value
      });

      callback();
    });
  })).pipe(concat(function (users) {
    callback(null, users);
  }));

  rs.on('error', function (err) {
    callback(err);
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

      var recipientAvatars = [];
      var count = 0;

      n.recipients.forEach(function (r) {
        usernamesDb.get('avatar!' + r, function (err, avatar) {
          if (!err && avatar) {
            recipientAvatars.push(avatar);
          } else {
            recipientAvatars.push(DEFAULT_AVATAR);
          }

          if (count === n.recipients.length - 1) {
            n.recipientAvatars = recipientAvatars;
          }

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
        });
      });
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
    var opts = [];

    if (err || !userHash) {
      opts.push(
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
      );
    } else if (username !== req.session.username) {
      callback(new Error('username taken'));
      return;
    }

    opts.push({
      type: 'put',
      key: 'avatar!' + req.session.userHash,
      value: req.body.avatar
    });

    usernamesDb.batch(opts, function (err) {
      if (err) {
        callback(err);
      } else {

        callback(null, true);
      }
    });
  });
};
