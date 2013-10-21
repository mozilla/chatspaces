'use strict';

module.exports = function(app, nconf, parallax, isLoggedIn) {
  app.get('/login', isLoggedIn, function (req, res) {
    res.json({
      email: req.session.email,
      message: 'logged in'
    });
  });

  app.get('/*', function (req, res) {
    res.render('index');
  });
};
