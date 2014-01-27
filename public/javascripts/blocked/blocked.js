angular.module('chatspaces.blocked', []).
controller('BlockedCtrl', function ($scope, $rootScope, $http, $translate, api) {
  api.call();

  $scope.unblockUser = function (userHash, idx) {
    $http({
      url: '/api/block/' + userHash,
      method: 'DELETE'
    }).success(function (data) {
      delete $rootScope.blocked[userHash];
    }).error(function (data) {
      $scope.errors = $translate('ERROR_COULD_NOT_UNBLOCK_USER');
    });
  };
});
