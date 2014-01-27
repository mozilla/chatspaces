angular.module('chatspaces.dashboard', []).
controller('DashboardCtrl', function ($scope, $rootScope, $http, $location, $timeout, $routeParams, api) {
  api.call();

  $http({
    url: '/api/profile',
    method: 'GET'
  }).success(function (data) {
    $rootScope.userHash = data.userHash;
    $rootScope.recipients = {};
    $rootScope.messages = {};
    $scope.isLoading = true;

    var recipientAvatars = [];

    var since = '';

    // load all the messages from the local cache
    localForage.getItem($rootScope.userHash + ':dashboardList', function (data) {
      if (data) {
        $rootScope.dashboardList = data;
      }

      $rootScope.dashboardList.forEach(function (d) {
        // remove any occurences of your own userHash and add the final message to the messages scope
        localForage.getItem($rootScope.userHash + ':dashMessage[' + d + ']', function (thread) {
          $rootScope.messages[d] = thread;
        });
      });

      if ($rootScope.dashboardList[0]) {
        since = '?since=' + $rootScope.dashboardList[0];
      }

      $http({
        url: '/api/feed' + since,
        method: 'GET'
      }).success(function (data) {
        $scope.isLoading = false;
      });
    });
  });

  $scope.isUnread = function (message) {
    var count = 0;

    $rootScope.notifications.forEach(function (n) {
      if (n === message.value.senderKey) {
        count ++;
      }
    });

    return count;
  };

  $scope.getThread = function (message) {
    if (message.value.reply) {
      $location.path('/thread/' + message.value.reply);
    } else {
      $location.path('/thread/' + message.key);
    }
  };
});
