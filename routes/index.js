'use strict';

module.exports = function(app, isLoggedIn) {
  app.get('/login', isLoggedIn, function (req, res) {
    // Persona email is already saved in the session but showing this so that you
    // can set other session items and return in this payload.
    res.json({
      email: req.session.email
    });
  });

  app.get('/*', function (req, res) {
    res.render('index');
  });
};
