'use strict';

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
      controller: 'HomeCtrl',
      templateUrl: 'partials/dashboard.html'
    })
    .otherwise({
      redirectTo: '/'
    });

  $locationProvider.html5Mode(true);
});
