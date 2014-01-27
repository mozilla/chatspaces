angular.module('chatspaces.friend', []).
controller('FriendCtrl', function ($scope, $rootScope, $http, $location, $translate, api) {
  api.call();

  $scope.users = [];
  $scope.user = '';
  $scope.showNewMessageGuide = true;

  localForage.getItem('newMessage', function (st) {
    if (st) {
      $scope.showNewMessageGuide = false;
    }
  });

  $scope.goToDashboard = function () {
    $location.path('/dashboard');
  };

  $scope.blockUser = function (userHash) {
    $http({
      url: '/api/block',
      data: {
        userHash: userHash
      },
      method: 'POST'
    }).success(function (data) {
      $scope.info = $translate('BLOCKED_USER');
      delete $rootScope.friends[userHash];
    }).error(function (data) {
      $scope.info = false;
      $scope.errors = $translate('ERROR_COULD_NOT_BLOCK_USER');
    });
  };

  $scope.deleteFriend = function (user) {
    $http({
      url: '/api/unfollow/' + user,
      method: 'DELETE'
    }).success(function (data) {
      delete $rootScope.friends[user];
      $scope.info = $translate('UNFOLLOWED_USER');
    }).error(function (data) {
      $scope.errors = $translate('ERROR_COULD_NOT_UNFOLLOW_USER');
    });
  };

  $scope.requestFriend = function (user) {
    $http({
      url: '/api/follow',
      data: {
        userHash: user.userHash
      },
      method: 'POST'
    }).success(function (data) {
      $scope.users = [];
      $scope.user = '';
      $scope.info = $translate('ADDED_USER');
    }).error(function (data) {
      $scope.errors = $translate('ERROR_COULD_NOT_FOLLOW_USER');
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
        $scope.errors = $translate('ERROR_COULD_NOT_SEARCH_USERS');
      });
    } else {
      $scope.users = [];
    }
  };
});
