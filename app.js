var express = require('express');
var configurations = module.exports;
var app = express();
var server = require('http').createServer(app);
var nconf = require('nconf');
var settings = require('./settings')(app, configurations, express);
var Parallax = require('meatspace-parallax');
var parallax = {};
var level = require('level');

nconf.argv().env().file({ file: 'local.json' });

var usernamesDb = level(nconf.get('db') + '/usernames', {
  createIfMissing: true,
  valueEncoding: 'json'
});

// Filters for routes
var isLoggedIn = function(req, res, next) {
  if (req.session.email) {
    if (!parallax[req.session.email]) {
      parallax[req.session.email] = new Parallax(req.session.user, {
        db: nconf.get('db') + '/users/' + req.session.email
      });
    }

    usernamesDb.get('email!' + req.session.email, function (err, username) {
      if (!err) {
        req.session.username = username;
      }
    });
    console.log(req.session.username)
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
require('./routes')(app, nconf, parallax, usernamesDb, isLoggedIn);

app.listen(process.env.PORT || nconf.get('port'));
