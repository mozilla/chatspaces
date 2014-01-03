'use strict';

var socket = io.connect(location.protocol + '//' + location.hostname +
  (location.port ? ':' + location.port : ''));

angular.module('chatspace', [
  'ngRoute',
  'chatspace.factories',
  'chatspace.controllers'
]).
run(function ($rootScope, $http, $location, $timeout, authenticate) {
  $rootScope.$on('$routeChangeStart', function (event, next, current) {
    $timeout(function () {
      if (!$rootScope.isAuthenticated) {
        $location.path('/');
      } else {
        $http({
          url: '/api/profile',
          method: 'GET'
        }).success(function (data) {
          $rootScope.email = data.email;
          $rootScope.username = data.username;
          $rootScope.userHash = data.userHash;
          $rootScope.avatar = data.avatar;
          $rootScope.isAuthenticated = true;
          $rootScope.picture = '';

          localForage.getItem($rootScope.userHash + ':lastPic', function (pic) {
            if (pic) {
              $rootScope.picture = pic;
            }
          });

          localForage.getItem($rootScope.userHash + ':latestMessageKey', function (key) {
            if (key) {
              $rootScope.latestMessage = key;
            }
          });

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
    }, 100);
  });
}).
service('user', function ($rootScope) {
  return {
    call: function () {
      $rootScope.isAuthenticated = false;
      $rootScope.settings = false;
      $rootScope.friends = {};
      $rootScope.messages = {};
      $rootScope.blocked = {};
      $rootScope.notifications = [];
    }
  }
}).
service('api', function ($http, $timeout) {
  return {
    call: function () {
      $timeout(function () {
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
}).
directive('onFinishRender', function ($timeout) {
  return {
    restrict: 'A',
    link: function (scope, element, attr) {
      if (scope.$last) {
        $timeout(function () {
          var avatars = $('.avatar');
          var amount = .12;

          for (var i = 0; i < avatars.length; i ++) {
            var img = avatars[i];
            var dpr = window.devicePixelRatio || 1;
            var width = img.width * dpr;
            var height = img.height * dpr;
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            ctx.beginPath();

            if (img.classList.contains('even')) {
              ctx.moveTo(amount * width, 0);
              ctx.lineTo(width - amount * width, 0);
              ctx.lineTo(width, height);
              ctx.lineTo(0, height);
              ctx.lineTo(amount * width, 0);
            } else {
              ctx.moveTo(0, 0);
              ctx.lineTo(width, 0);
              ctx.lineTo(width - width * amount, height);
              ctx.lineTo(amount * width, height);
              ctx.lineTo(0, 0);
            }

            ctx.clip();
            ctx.drawImage(img, 0, 0, 80, 60, 0, 0, width, height);

            canvas.style.width = img.width + 'px';
            canvas.style.height = img.height + 'px';
            var margin = (-amount * img.width | 0) + 'px';
            canvas.style.marginRight = margin;
            img.parentNode.insertBefore(canvas, img);
            img.style.display = 'none';
          }
          scope.$emit('ngRepeatFinished');
        });
      }
    }
  };
});
