angular.module('chatspaces.home', []).
controller('HomeCtrl', function ($scope, $rootScope, authenticate) {
  $scope.login = function () {
    authenticate.login();
    $rootScope.toggleSettings();
  };
});
