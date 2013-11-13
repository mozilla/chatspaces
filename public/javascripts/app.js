'use strict';

var socket = io.connect(location.protocol + '//' + location.hostname +
  (location.port ? ':' + location.port : ''));

angular.module('chatspace', [
  'ngRoute',
  'chatspace.factories',
  'chatspace.controllers'
]).
run(function ($rootScope, $http, $location, persona) {
  $rootScope.$on('$routeChangeStart', function (event, next, current) {
    setTimeout(function () {
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
          $rootScope.isAuthenticated = true;

          socket.emit('join', {
            email: data.email
          });
        }).error(function (data) {
          persona.login();
        });
      }
    }, 2);
  });
}).
service('user', function ($rootScope) {
  return {
    call: function () {
      $rootScope.isAuthenticated = false;
      $rootScope.settings = false;
      $rootScope.hasNewNotifications = 0;
      $rootScope.friends = {};
      $rootScope.messages = [];
      $rootScope.blocked = {};
      $rootScope.currentFriend;
      $rootScope.notifications = [];
      $rootScope.selectedFriend = false;
    }
  }
}).
service('api', function ($http) {
  return {
    call: function () {
      setTimeout(function () {
        console.log('calling services');
        $http({
          url: '/api/friends',
          method: 'GET'
        });

        $http({
          url: '/api/blocked',
          method: 'GET'
        });

        $http({
          url: '/api/notifications',
          method: 'GET'
        });
      }, 100);
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
    .when('/drafts', {
      controller: 'DraftsCtrl',
      templateUrl: 'partials/drafts.html'
    })
    .otherwise({
      redirectTo: '/'
    });

  $locationProvider.html5Mode(true);
});
