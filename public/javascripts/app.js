'use strict';

var socket = io.connect(location.protocol + '//' + location.hostname +
  (location.port ? ':' + location.port : ''));

angular.module('chatspace', [
  'ngRoute',
  'chatspace.factories',
  'chatspace.controllers'
]).
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
    .when('/friends', {
      controller: 'FriendCtrl',
      templateUrl: 'partials/friends.html'
    })
    .otherwise({
      redirectTo: '/'
    });

  $locationProvider.html5Mode(true);
});
