'use strict';

angular.module('chatspace.factories', []).
  factory('persona', function ($rootScope, $http, $location, user) {
    var resetUser = function () {
      socket.emit('disconnect', {
        email: $rootScope.email
      });

      localStorage.removeItem('personaEmail');
      user.call();
    };

    var login = function () {
      navigator.id.get(function (assertion) {
        if (!assertion) {
          console.log('No assertion provided');
          return;
        }

        $http({
          url: '/persona/verify',
          method: 'POST',
          data: { assertion: assertion }
        }).success(function (data) {

          if (data.status === 'okay') {
            $rootScope.isAuthenticated = true;
            $rootScope.toggleSettings();

            $http({
              url: '/api/profile',
              method: 'GET'
            }).success(function (data) {
              localStorage.setItem('personaEmail', data.email);
              $rootScope.email = data.email;
              $rootScope.username = data.username;
              $rootScope.gravatar = data.gravatar;

              if (data.username) {
                $location.path('/dashboard');
              } else {
                $location.path('/profile');
              }

            }).error(function (data) {

              $location.path('/profile');
            });
          } else {

            resetUser();
            console.log('Login failed');
          }
        }).error(function (data) {

          resetUser();
          console.log('Login failed');
        });
      });
    };

    var logout = function () {
      $http({
        url: '/persona/logout',
        method: 'POST'
      }).success(function (data) {

        if (data.status === 'okay') {
          $rootScope.toggleSettings();
          $location.path('/');
          resetUser();
        } else {

          console.log('Logout failed because ' + data.reason);
        }
      }).error(function (data) {

        console.log('error logging out: ', data);
      })
    };

    return {
      login: login,
      logout: logout
    };
  });
