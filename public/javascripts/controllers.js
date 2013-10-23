'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl', function ($scope, persona, $rootScope, $http, $location) {
    $rootScope.isAuthenticated = false;
    $rootScope.settings = false;

    var settingsView = $('main');

    $rootScope.isValidUser = function () {
      if (!($rootScope.isAuthenticated || $rootScope.username)) {
        $location.path('/');
      }
    };

    $rootScope.checkLogin = function () {
      $http({
        url: '/api/login',
        method: 'POST'
      }).success(function (data) {

        $rootScope.email = data.email;
        $rootScope.username = data.username
      }).error(function (data) {

        localStorage.removeItem('personaEmail')
        console.log('Login failed because ' + data.message);
      });
    };

    $rootScope.toggleSettings = function () {
      if ($rootScope.settings) {
        $rootScope.settings = false;
        settingsView.removeClass('on').addClass('off');
      } else {
        $rootScope.settings = true;
        settingsView.removeClass('off').addClass('on');
      }
    };

    var email = localStorage.getItem('personaEmail');

    if (email) {
      $rootScope.isAuthenticated = true;
    }

    $rootScope.checkLogin();

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
        console.log('got here')
        $location.path('/profile');
      } else {
        $location.path('/dashboard');
      }
    }
  }).
  controller('DashboardCtrl', function ($scope, $rootScope, $http) {
    console.log('dashboard view');
    $rootScope.isValidUser();
    $rootScope.checkLogin();
  }).
  controller('ProfileCtrl', function ($scope, $rootScope, $http, $location) {
    console.log('profile page');
    if (!$rootScope.isAuthenticated) {
      $location.path('/');
    } else {
      $rootScope.checkLogin();
    }

    $scope.updateProfile = function () {
      $http({
        url: '/api/profile',
        data: {
          username: $scope.username
        },
        method: 'PUT'
      }).success(function (data) {
        $scope.errors = false;
        $scope.info = data.message;
        $rootScope.username = data.username;
        $scope.username = data.username;
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
        console.log('Invalid username ', data.message);
      });
    };
  });
