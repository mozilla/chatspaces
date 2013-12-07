'use strict';

var socket = io.connect(location.protocol + '//' + location.hostname +
  (location.port ? ':' + location.port : ''));

angular.module('chatspace', [
  'ngRoute',
  'chatspace.factories',
  'chatspace.controllers'
]).
run(function ($rootScope, $http, $location, authenticate) {
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

          if (!$rootScope.username) {
            $location.path('/profile');
          } else if ($location.path() === '/') {
            $location.path('/dashboard');
          }
        }).error(function (data) {
          authenticate.logout();
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
      $rootScope.friends = {};
      $rootScope.messages = [];
      $rootScope.blocked = {};
      $rootScope.notifications = [];
    }
  }
}).
service('api', function ($http) {
  return {
    call: function () {
      setTimeout(function () {
        console.log('calling services');
        $http({
          url: '/api/following',
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
      }, 500);
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
    .when('/message', {
      controller: 'MessageCtrl',
      templateUrl: 'partials/message.html'
    })
    .when('/drafts', {
      controller: 'DraftsCtrl',
      templateUrl: 'partials/drafts.html'
    })
    .when('/thread/:senderKey', {
      controller: 'MessageCtrl',
      templateUrl: 'partials/thread.html'
    })
    .otherwise({
      redirectTo: '/'
    });

  $locationProvider.html5Mode(true);
}).
filter('orderObjectBy', function () {
  return function (items, field) {
    var filtered = [];

    angular.forEach(items, function (item) {
      filtered.push(item);
    });

    filtered.sort(function (a, b) {
      return a[field] > b[field];
    });

    filtered.reverse();

    return filtered;
  };
});
