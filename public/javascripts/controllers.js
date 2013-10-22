'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl', function ($scope, persona, $rootScope, $http, $location) {
    $rootScope.isAuthenticated = false;
    $rootScope.username = '';

    $rootScope.isValidUser = function () {
      if (!($rootScope.isAuthenticated || $rootScope.username)) {
        $location.path('/');
      }
    };

    var email = localStorage.getItem('personaEmail');

    if (email) {
      $rootScope.isAuthenticated = true;
    }

    $http({
      url: '/login',
      method: 'GET'
    }).success(function (data) {

      $rootScope.email = data.email;
      $rootScope.username = data.username
    }).error(function (data) {

      localStorage.removeItem('personaEmail')
      console.log('Login failed because ' + data);
    });

    $rootScope.login = function () {
      persona.login();
    };

    $rootScope.logout = function () {
      persona.logout();
    }
  }).
  controller('HomeCtrl', function ($scope, $rootScope, $location) {
    console.log('home view');
    if ($rootScope.isAuthenticated) {
      if (!$rootScope.username) {
        $location.path('/profile');
      } else {
        $location.path('/dashboard');
      }
    }
  }).
  controller('DashboardCtrl', function ($scope, $rootScope, $http) {
    console.log('dashboard view');
    $rootScope.isValidUser();
  }).
  controller('ProfileCtrl', function ($scope, $rootScope, $http) {
    console.log('profile page');
    $scope.updateProfile = function () {
      $http({
        url: '/api/profile',
        data: {
          username: $scope.username
        },
        method: 'PUT'
      }).success(function (data) {

        $rootScope.username = data.username;
      }).error(function (data) {

        console.log('Invalid username ', data.message);
      });
    };
  });
