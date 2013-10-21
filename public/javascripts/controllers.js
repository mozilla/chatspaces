'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl', function ($scope, persona, $rootScope, $http, $location) {
    $rootScope.isAuthenticated = false;
    var email = localStorage.getItem('personaEmail');

    if (email) {
      if (!$rootScope.email) {
        $http({
          url: '/login',
          method: 'GET'
        }).success(function (data) {

          $rootScope.isAuthenticated = true;
          $rootScope.email = data.email;
        }).error(function (data) {

          localStorage.removeItem('personaEmail')
          console.log('Login failed because ' + data);
        });
      } else {
        console.
        $rootScope.email = email;
      }
    }

    $rootScope.login = function () {
      persona.login();
    };

    $rootScope.logout = function () {
      persona.logout();
    }
  }).
  controller('HomeCtrl', function ($scope, persona, $rootScope, $http) {
    console.log('home view');
    console.log($rootScope.email)
  });
