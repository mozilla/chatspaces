var express = require('express');
var configurations = module.exports;
var app = express();
var server = require('http').createServer(app);
var nconf = require('nconf');
var settings = require('./settings')(app, configurations, express);
var redis = require('redis');
var redisClient = redis.createClient();

var user = require('./lib/user');

var io = require('socket.io').listen(server);

io.configure(function () {
  io.set('transports', ['websocket']);
  io.set('log level', 1);
});

io.sockets.on('connection', function (socket) {
  socket.on('join', function (data) {
    var userHash = user.setUserHash(data.email);
    console.log('socket join by ', userHash);
    socket.join(userHash);
  });
});

nconf.argv().env().file({ file: 'local.json' });

// Filters for routes
var isLoggedIn = function(req, res, next) {
  if (req.session.email) {
    req.session.userHash = user.setUserHash(req.session.email);

    user.getUsername(req, function (err, username) {
      if (!err) {
        req.session.username = username;
      }

      next();
    });
  } else {
    res.status(400);
    next(new Error('Not logged in'));
  }
};

require('express-persona')(app, {
  audience: nconf.get('domain') + ':' + nconf.get('authPort')
});

// routes
require('./routes')(app, io, nconf, user, redisClient, isLoggedIn);

server.listen(process.env.PORT || nconf.get('port'));
