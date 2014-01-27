angular.module('chatspaces.friend', []).
controller('FriendCtrl', function ($scope, $rootScope, $http, $location, api) {
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
      $scope.info = data.message;
      delete $rootScope.friends[userHash];
    }).error(function (data) {
      $scope.info = false;
      $scope.errors = data.message;
    });
  };

  $scope.deleteFriend = function (user) {
    $http({
      url: '/api/unfollow/' + user,
      method: 'DELETE'
    }).success(function (data) {
      delete $rootScope.friends[user];
      $scope.info = data.message;
    }).error(function (data) {
      $scope.errors = data.message;
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
      $scope.info = data.message;
    }).error(function (data) {
      $scope.errors = data.message;
    });
  };

  $scope.searchUsers = function () {
    $scope.info = false;
    $scope.errors = false;
    if ($scope.user) {
      $http({
        url: '/api/search',
        data: {
          username: $scope.user.toString().trim()
        },
        method: 'POST'
      }).success(function (data) {
        if (data.users.length < 1) {
          $scope.info = 'No users found';
        }
        $scope.users = data.users;
      }).error(function (data) {
        $scope.errors = data.message;
      });
    } else {
      $scope.info = 'No users found';
      $scope.users = [];
    }
  };
});
