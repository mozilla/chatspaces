var express = require('express');
var configurations = module.exports;
var app = express();
var server = require('http').createServer(app);
var nconf = require('nconf');
var settings = require('./settings')(app, configurations, express);
var Parallax = require('meatspace-parallax');
var parallax = {};
var level = require('level');
var crypto = require('crypto');

var io = require('socket.io').listen(server);

io.configure(function () {
  io.set('transports', ['websocket']);
  io.set('log level', 1);
});

io.sockets.on('connection', function (socket) {
  socket.on('join', function (data) {
    console.log('socket join by ', crypto.createHash('md5').update(data.email).digest('hex'))
    socket.join(crypto.createHash('md5').update(data.email).digest('hex'));
  });

});

nconf.argv().env().file({ file: 'local.json' });

var usernamesDb = level(nconf.get('db') + '/usernames', {
  createIfMissing: true,
  valueEncoding: 'json'
});

// Filters for routes
var isLoggedIn = function(req, res, next) {
  if (req.session.email) {
    req.session.userHash = crypto.createHash('md5').update(req.session.email).digest('hex');

    if (!parallax[req.session.userHash]) {
      parallax[req.session.userHash] = new Parallax(req.session.userHash, {
        db: nconf.get('db') + '/users/' + req.session.userHash
      });
    }

    usernamesDb.get('email!' + req.session.email, function (err, username) {
      if (!err) {
        req.session.username = username;
      }
    });

    next();
  } else {
    res.status(400);
    next(new Error('Not logged in'));
  }
};

require('express-persona')(app, {
  audience: nconf.get('domain') + ':' + nconf.get('authPort')
});

// routes
require('./routes')(app, io, nconf, parallax, usernamesDb, crypto, Parallax, isLoggedIn);

server.listen(process.env.PORT || nconf.get('port'));
