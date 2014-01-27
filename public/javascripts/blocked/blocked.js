angular.module('chatspaces.blocked', []).
controller('BlockedCtrl', function ($scope, $rootScope, $http, api) {
  api.call();

  $scope.unblockUser = function (userHash, idx) {
    $http({
      url: '/api/block/' + userHash,
      method: 'DELETE'
    }).success(function (data) {
      delete $rootScope.blocked[userHash];
    }).error(function (data) {
      $scope.errors = data.message;
    });
  };
});
