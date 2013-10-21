'use strict';

module.exports = function(app, nconf, isLoggedIn) {
  var Parallax = require('meatspace-parallax');
  var parallax = {};

  app.get('/login', isLoggedIn, function (req, res) {
    if (!parallax[req.session.email]) {
      parallax[req.session.email] = new Parallax(req.session.user, {
        db: nconf.get('db') + '/users/' + req.session.email
      });
    }

    res.json({
      message: 'logged in'
    });
  });

  app.get('/*', function (req, res) {
    res.render('index');
  });
};
