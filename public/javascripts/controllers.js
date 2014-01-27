'use strict';

angular.module('chatspaces.controllers', [
  'chatspaces.dashboard',
  'chatspaces.friend',
  'chatspaces.profile',
  'chatspaces.blocked',
  'chatspaces.home',
  'chatspaces.message',
  'chatspaces.drafts'
]).
controller('AppCtrl',
  function ($scope, authenticate, $rootScope, $http, $location, $routeParams, $translate, user, localCache, cameraHelper) {

  user.call();
  $rootScope.friendPredicate = '-username';
  $rootScope.recipients = {};
  $rootScope.recipientAvatars = [];
  $rootScope.latestThreadMessage;
  $rootScope.dashboardList = [];
  $rootScope.showCamera = false;
  $rootScope.showFollowing = false;

  $rootScope.language = window.navigator.userLanguage || window.navigator.language || 'en';
  $translate.uses($rootScope.language);

  socket.on('friend', function (data) {
    $rootScope.$apply(function () {
      $rootScope.friends[data.friend.userHash] = {
        username: data.friend.username,
        avatar: data.friend.avatar,
        userHash: data.friend.userHash,
        senderUserHash: data.friend.senderUserHash
      };
    });
  });

  socket.on('notification', function (data) {
    $rootScope.$apply(function () {
      if (data && $rootScope.notifications.indexOf(data) === -1 &&
         (!$routeParams.senderKey || $routeParams.senderKey !== data)) {
        $rootScope.notifications.push(data);
        $rootScope.latestMessage = data;
      }
    });
  });

  socket.on('message', function (data) {
    $rootScope.$apply(function () {
      var senderKey = data.value.reply || data.value.senderKey;

      if ($location.path() === '/dashboard' || $routeParams.senderKey === senderKey) {
        var key = data.value.reply || data.key;

        // also save message to local cache
        data.updated = data.value.created;

        $rootScope.messages[data.key] = data;

        localForage.setItem($rootScope.userHash + ':message[' + data.key + ']', data);
        localForage.setItem($rootScope.userHash + ':latestMessageKey', key); // last one at the top is the latest dashboard key
        localCache.setItem(key, data);

        if (data.value.recipientAvatars) {
          $rootScope.recipientAvatars = data.value.recipientAvatars;
        }

        if ($routeParams.senderKey === senderKey) {
          $rootScope.latestThreadMessage = data.key; // last one at the top is the latest thread key
          data.value.recipients.forEach(function (userHash) {
            if (userHash !== $rootScope.userHash) {
              $rootScope.recipients[userHash] = userHash;
            }
          });

          $rootScope.reply = senderKey;
        } else {
          $rootScope.latestMessage = key;
        }
      }
    });
  });

  socket.on('blocked', function (data) {
    $rootScope.$apply(function () {
      $rootScope.blocked[data.user.userHash] = {
        username: data.user.username,
        avatar: data.user.avatar,
        userHash: data.user.userHash
      };
    });
  });

  $scope.loadDashboard = function () {
    var since = '';

    if ($rootScope.latestMessage) {
      since = '?since=' + $rootScope.latestMessage;
    }

    $http({
      url: '/api/feed?since=' + since,
      method: 'GET'
    }).success(function (data) {
      $location.path('/dashboard');
    });
  };

  $scope.getDate = function (timestamp) {
    return moment.unix(Math.round(timestamp / 1000)).fromNow();
  };

  $rootScope.toggleSettings = function () {
    if ($rootScope.settings) {
      $rootScope.settings = false;
    } else {
      $rootScope.settings = true;
    }
  };

  $scope.newMessage = function () {
      $rootScope.settings = false;
  };

  localForage.getItem('personaEmail', function (email) {
    if (email) {
      $rootScope.isAuthenticated = true;
    }
  });

  $scope.logout = function () {
    authenticate.logout();
  }

  $rootScope.promptCamera = function () {
    if ($rootScope.isAuthenticated && navigator.getMedia) {
      $rootScope.showCamera = true;
      cameraHelper.startStream();
    } else {
      $rootScope.cancelCamera();
    }
  };

  $rootScope.cancelCamera = function () {
    $rootScope.showCamera = false;
    $rootScope.showFollowing = false;
    $('#video-preview').empty();
    cameraHelper.resetStream();
  };
});
