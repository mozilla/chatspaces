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

        if (!$rootScope.username) {
          $location.path('/profile');
        } else {
          $rootScope.getFriends();
        }
      }).error(function (data) {

        $rootScope.email = data.email;
        $rootScope.gravatar = data.gravatar;
      });
    }
  });
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
