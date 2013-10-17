'use strict';

angular.module('pea.factories', []).
  factory('persona', function ($rootScope, $http) {
    var resetUser = function () {
      localStorage.removeItem('personaEmail');
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
            $http({
              url: '/login',
              method: 'GET'
            }).success(function (data) {

              localStorage.setItem('personaEmail', data.email);
              $rootScope.isAuthenticated = true;
              $rootScope.email = data.email;
            }).error(function (data) {

              resetUser();
              console.log('Login failed');
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
