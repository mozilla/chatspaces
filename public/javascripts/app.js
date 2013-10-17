'use strict';

angular.module('pea', [
  'ngRoute',
  'pea.factories',
  'pea.controllers'
]).
config(function ($routeProvider, $locationProvider) {
  $routeProvider
    .when('/', {
      controller: 'HomeCtrl',
      templateUrl: 'partials/home.html'
    })
    .otherwise({
      redirectTo: '/'
    });

  $locationProvider.html5Mode(true);
});
