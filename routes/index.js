'use strict';

module.exports = function(app, nconf, parallax, usernamesDb, isLoggedIn) {
  var gravatar = require('gravatar');

  app.get('/', function (req, res) {
    res.render('index');
  });

  app.get('/api/login', isLoggedIn, function (req, res) {
    usernamesDb.get('email!' + req.session.email, function (err, username) {
      if (err) {
        console.log('username not found, redirect to profile page');
        res.status(400);

        res.json({
          message: 'username not created'
        });
      } else {
        req.session.username = username;

        res.json({
          email: req.session.email,
          username: username,
          gravatar: gravatar.url(req.session.email, { s: 80 })
        });
      }
    });
  });

  app.put('/api/profile', isLoggedIn, function (req, res) {
    var username = '';

    if (req.body.username) {
      username = req.body.username.toString().toLowerCase().replace(/[^\w+$]/gi, '');
    }

    if (username === req.session.username) {
      res.json({
        username: username
      });
      return;
    }

    if (username.length < 1) {
      res.status(400);
      res.json({
        message: 'username is invalid'
      });
    } else {

      usernamesDb.get('username!' + username, function (err, u) {
        if (err) {
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
              value: req.session.email
            }
          ];

          usernamesDb.batch(opts, function (err) {
            if (err) {
              res.status(400);
              res.json({
                message: err.toString()
              });
            } else {
              console.log('new username ', username)
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

  app.get('/*', function (req, res) {
    res.render('index');
  });
};
