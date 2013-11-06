'use strict';

var socket = io.connect(location.protocol + '//' + location.hostname +
  (location.port ? ':' + location.port : ''));

angular.module('chatspace', [
  'ngRoute',
  'chatspace.factories',
  'chatspace.controllers'
]).
run(function ($rootScope, $http, $location) {
  $rootScope.$on('$routeChangeStart', function (event, next, current) {
    if (!$rootScope.isAuthenticated) {
      $location.path('/');
    } else {
      $http({
        url: '/api/profile',
        method: 'GET'
      }).success(function (data) {
        $rootScope.email = data.email;
        $rootScope.username = data.username;
        $rootScope.gravatar = data.gravatar;
        $rootScope.userHash = data.userHash;

        socket.emit('join', {
          email: data.email
        });
      }).error(function (data) {

        $rootScope.email = data.email;
        $rootScope.gravatar = data.gravatar;
      });
    }
  });
}).
service('api', function ($http, $rootScope, $location) {
  return {
    call: function () {
      $http({
        url: '/api/friends',
        method: 'GET'
      });

      socket.on('connect', function () {
        socket.on('friend', function (data) {
          $rootScope.$apply(function () {
            $rootScope.friends[data.friend.userHash] = {
              username: data.friend.username,
              avatar: data.friend.avatar,
              userHash: data.friend.userHash
            };
          });
        });

        socket.on('notification', function (data) {
          $rootScope.$apply(function () {
            $rootScope.notifications.push(data.notification);
            notifications.addClass('on').text($rootScope.notifications.length);
          });
        });

        socket.on('blocked', function (data) {
          $rootScope.$apply(function () {
            $rootScope.blocked[data.user.userHash] = {
              username: data.user.username,
              avatar: data.user.avatar,
              userHash: data.user.userHash
            };
          });
        });
      });

      if (!$rootScope.username) {
        $location.path('/profile');
      }
    }
  };
}).
config(function ($routeProvider, $locationProvider) {
  $routeProvider
    .when('/', {
      controller: 'HomeCtrl',
      templateUrl: 'partials/home.html'
    })
    .when('/profile', {
      controller: 'ProfileCtrl',
      templateUrl: 'partials/profile.html'
    })
    .when('/dashboard', {
      controller: 'DashboardCtrl',
      templateUrl: 'partials/dashboard.html'
    })
    .when('/blocked', {
      controller: 'BlockedCtrl',
      templateUrl: 'partials/blocked.html'
    })
    .when('/friends', {
      controller: 'FriendCtrl',
      templateUrl: 'partials/friends.html'
    })
    .otherwise({
      redirectTo: '/'
    });

  $locationProvider.html5Mode(true);
});
