angular.module('chatspaces.drafts', []).
controller('DraftsCtrl', function ($scope, $rootScope, $location, $http) {
  $scope.draftMessages = {};
  $scope.draftList = [];

  $http({
    url: '/api/profile',
    method: 'GET'
  }).success(function (data) {
    $rootScope.userHash = data.userHash;

    localForage.getItem($rootScope.userHash + ':draftList', function (drafts) {
      if (drafts) {
        $scope.draftList = drafts;

        drafts.forEach(function (d) {
          localForage.getItem($rootScope.userHash + ':draft[' + d + ']', function (message) {
            $scope.$apply(function () {
              $scope.draftMessages[d] = message;
            });
          });
        });
      }
    });
  });

  $scope.resendMessage = function (message) {
    $http({
      url: '/api/message',
      data: message.value,
      method: 'POST'
    }).success(function (data) {
      localForage.setItem($rootScope.userHash + ':lastPic', message.value.picture);
      delete $scope.draftMessages[message.key];
      $scope.draftList.splice($scope.draftList.indexOf(message.key), 1);

      localForage.removeItem($rootScope.userHash + ':draft[' + message.key + ']');
      localForage.setItem($rootScope.userHash + ':draftList', $scope.draftList);
    }).error(function () {
      console.log('could not send, keeping in drafts');
    });
  };
});
