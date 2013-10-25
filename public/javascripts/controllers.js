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
      $rootScope.isValidUser();

      $http({
        url: '/api/profile',
        method: 'GET'
      }).success(function (data) {
        $rootScope.email = data.email;
        $rootScope.username = data.username;
        $rootScope.gravatar = data.gravatar;

        socket.emit('join', {
          email: data.email
        });
      }).error(function (data) {

        $rootScope.email = data.email;
        $rootScope.gravatar = data.gravatar;
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
    if ($rootScope.isAuthenticated) {
      if (!$rootScope.username) {
        $location.path('/profile');
      } else {
        $location.path('/dashboard');
      }
    }
  }).
  controller('FriendCtrl', function ($scope, $rootScope, $http) {
    $rootScope.checkLogin();
    $scope.showMessage = false;
    $scope.users = [];
    $scope.user = '';
    $scope.friends = [];

    $http({
      url: '/api/friends',
      method: 'GET'
    });

    socket.on('connect', function () {
      socket.on('friend', function (data) {
        $scope.$apply(function () {
          $scope.friends.unshift(data.friend);
        });
      });
    });

    $scope.requestFriend = function (user) {
      $http({
        url: '/api/friend',
        data: {
          username: user.username
        },
        method: 'POST'
      }).success(function (data) {
        $scope.users = [];
        $scope.info = data.message;
      }).error(function (data) {
        $scope.errors = data.message;
      });
    };

    $scope.searchUsers = function () {
      if ($scope.user) {
        $http({
          url: '/api/search',
          data: {
            username: $scope.user.toString().trim()
          },
          method: 'POST'
        }).success(function (data) {
          $scope.users = data.users;
        }).error(function (data) {
          $scope.errors = data.message;
        });
      } else {
        $scope.users = [];
      }
    };
  }).
  controller('DashboardCtrl', function ($scope, $rootScope, $http) {
    if (!$rootScope.isAuthenticated) {
      $location.path('/');
    }

    $scope.showMessage = false;

    var newMessageForm = $('.message');

    $scope.toggleMessage = function () {
      $scope.errors = false;
      $scope.info = false;

      if ($scope.showMessage) {
        $scope.showMessage = false;
        $scope.message = '';
        $scope.picture = '';
        newMessageForm.removeClass('on');
      } else {
        $scope.showMessage = true;
        newMessageForm.addClass('on');
      }
    };

    $scope.sendMessage = function () {
      $http({
        url: '/api/message',
        data: {
          message: $scope.message,
          picture: $scope.picture
        },
        method: 'POST'
      }).success(function (data) {
        $scope.errors = false;
        $scope.info = data.message;
        $scope.message = '';
        $scope.picture = '';
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
      });
    };
  }).
  controller('ProfileCtrl', function ($scope, $rootScope, $http, $location) {
    $scope.currentUsername = $rootScope.username;

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
        $scope.username = $scope.currentUsername = data.username;
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
      });
    };
  });
