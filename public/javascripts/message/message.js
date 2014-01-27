angular.module('chatspaces.message', []).
controller('MessageCtrl', function ($scope, $rootScope, $http, $routeParams, $location, $translate, cameraHelper, api) {
  api.call();

  var since = '';

  $rootScope.messages = {};
  $scope.formDate = {};
  $scope.cancelCamera();

  var resetForm = function () {
    if (!$routeParams.senderKey) {
      $rootScope.recipients = {};
      $scope.reply = false;
    }

    $scope.recipientArr = [];
    $scope.errors = false;
    $scope.message = '';
    $scope.preview = '';
    $scope.posting = false;
    $('#video-preview').empty();
    cameraHelper.resetStream();
  };

  var escapeHtml = function (text) {
    if (text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  };

  var getThread = function () {
    $http({
      url: '/api/thread/' + $routeParams.senderKey + since,
      method: 'GET'
    }).success(function (data) {
      $scope.isLoading = false;
      $scope.errors = false;
    }).error(function (data) {
      $scope.info = false;
      $scope.errors = $translate('ERROR_COULD_NOT_RETRIEVE_THREAD');
    });
  };

  resetForm();

  if ($rootScope.hasNewNotifications < 0) {
    $rootScope.hasNewNotifications = 0;
  }

  if ($routeParams.senderKey) {
    $rootScope.notifications.splice($rootScope.notifications.indexOf($routeParams.senderKey), 1);

    $rootScope.reply = $routeParams.senderKey;
    $rootScope.threadList = [];

    $http({
      url: '/api/profile',
      method: 'GET'
    }).success(function (data) {
      $rootScope.userHash = data.userHash;
      $rootScope.recipients = {};
      $rootScope.messages = {};
      $scope.isLoading = true;

      localForage.getItem($rootScope.userHash + ':threadList[' + $routeParams.senderKey + ']', function (data) {
        if (data) {
          $rootScope.threadList = data;
          $rootScope.latestThreadMessage = data[0];

          since = '?since=' + $rootScope.latestThreadMessage;
        }

        $rootScope.threadList.forEach(function (d) {
          localForage.getItem($rootScope.userHash + ':message[' + d + ']', function (message) {
            $rootScope.messages[d] = message;

            message.value.recipients.forEach(function (userHash) {
              if (userHash !== $rootScope.userHash) {
                $rootScope.recipients[userHash] = userHash;
              }
            });

            $rootScope.recipientAvatars = message.value.recipientAvatars;
          });
        });

        getThread();
        $scope.isLoading = false;
      });
    });
  }

  $scope.recordCamera = function () {
    cameraHelper.startScreenshot(10, 0.2, function (pictureData) {
      $scope.$apply(function () {
        $rootScope.picture = pictureData;
      });
    });
  };

  $scope.showRecipients = function () {
    $scope.cancelCamera();
    $rootScope.showFollowing = true;
  };

  $scope.toggleRecipient = function (userHash) {
    if ($rootScope.recipients[userHash]) {
      delete $rootScope.recipients[userHash];
    } else {
      $rootScope.recipients[userHash] = userHash;
    }
  };

  $scope.sendMessage = function () {
    // if a picture hasn't been selected, jump to the camera overlay
    if (!$rootScope.picture) {
      $scope.promptCamera();
      return;
    }

    if (!$scope.posting) {
      $scope.posting = true;

      for (var r in $rootScope.recipients) {
        $scope.recipientArr.push(r);
      }

      // Also add yourself to the message so you can get replies.
      if ($scope.recipientArr.indexOf($rootScope.userHash) === -1) {
        $scope.recipientArr.push($rootScope.userHash);
      }

      var formData = {
        message: escapeHtml($scope.message),
        picture: escapeHtml($rootScope.picture),
        recipients: $scope.recipientArr
      };

      if ($routeParams.senderKey && $rootScope.reply) {
        formData.reply = $rootScope.reply;
      }

      $http({
        url: '/api/message',
        data: formData,
        method: 'POST'
      }).success(function (data) {
        localForage.setItem($rootScope.userHash + ':lastPic', $rootScope.picture);
        localForage.setItem('newMessage', false);
        localForage.setItem('firstMessage', false);
        $rootScope.hasMessages = true;
        $rootScope.cancelCamera();
        resetForm();

        if (!$routeParams.senderKey) {
          $location.path('/thread/' + data.key);
        }
      }).error(function (data) {
        // A failed message goes immediately into the Drafts section
        var created = Math.round(Date.now() / 1000);
        console.log('error sending post');
        localForage.getItem($rootScope.userHash + ':draftList', function (drafts) {
          if (!drafts) {
            drafts = [];
          }

          if (drafts.indexOf(created) === -1) {
            drafts.push(created);
            localForage.setItem($rootScope.userHash + ':draftList', drafts);
            localForage.setItem($rootScope.userHash + ':draft[' + created + ']', {
              key: created,
              value: formData
            });
          }

          $location.path('/drafts');
        });
      });
    }
  };
});
