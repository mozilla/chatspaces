'use strict';

angular.module('chatspace.factories', []).
  factory('persona', function ($rootScope, $http, $location) {
    var resetUser = function () {
      localStorage.removeItem('personaEmail');
      $rootScope.email = false;
      $rootScope.isAuthenticated = false;
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

            $http({
              url: '/api/login',
              method: 'GET'
            }).success(function (data) {
              localStorage.setItem('personaEmail', data.email);
              $rootScope.email = data.email;
              $rootScope.username = data.username;
              $location.path('/dashboard');

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
