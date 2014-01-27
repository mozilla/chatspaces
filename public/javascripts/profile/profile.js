angular.module('chatspaces.profile', []).
controller('ProfileCtrl', function ($scope, $rootScope, $http, $location, cameraHelper) {
  $scope.currentUsername = $rootScope.username;
  $scope.cacheInfo = false;
  $scope.selectedUsername = false;

  localForage.getItem('newUser', function (st) {
    if (!st) {
      $location.path('/profile');
    }
  });

  $scope.resetCache = function () {
    localForage.clear();
    $rootScope.latestMessage = false;
    $scope.cacheInfo = 'Local cache reset';
  };

  $scope.updateAvatar = function () {
    cameraHelper.startScreenshot(1, 0, function (pictureData) {
      $scope.$apply(function () {
        $rootScope.avatar = pictureData;
      });
    });
  };

  $scope.saveAvatar = function () {
    $scope.updateProfile(function () {
      $scope.selectedUsername = true;
      $scope.cancelCamera();
    });
  };

  $scope.searchFriends = function () {
    // new user is flagged as existing user once they go through the username and avatar process
    localForage.setItem('newUser', false);
    $location.path('/search');
  };

  $scope.saveUsername = function () {
    $scope.updateProfile(function () {
      $scope.promptCamera();
    });
  };

  $scope.updateProfile = function (callback) {
    $http({
      url: '/api/profile',
      data: {
        username: $scope.username,
        avatar: $rootScope.avatar
      },
      method: 'PUT'
    }).success(function (data) {
      $scope.errors = false;
      $rootScope.username = $scope.username = $scope.currentUsername = data.username;

      if (callback) {
        callback();
      }
    }).error(function (data) {
      $scope.info = false;
      $scope.errors = data.message;
    });
  };
});
