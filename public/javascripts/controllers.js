'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl', function ($scope, persona, $rootScope, $http, $location) {
    $rootScope.isAuthenticated = false;
    $rootScope.settings = false;
    $rootScope.hasNewNotifications = 0;
    $rootScope.friends = {};
    $rootScope.messages = {};
    $rootScope.blocked = {};
    $rootScope.currentFriend;
    $rootScope.notifications = [];

    socket.on('friend', function (data) {
      $rootScope.$apply(function () {
        $rootScope.friends[data.friend.userHash] = {
          username: data.friend.username,
          avatar: data.friend.avatar,
          userHash: data.friend.userHash,
          senderUserHash: data.friend.senderUserHash,
          unread: data.friend.unread
        };
      });
    });

    socket.on('notification', function (data) {
      $rootScope.$apply(function () {
        if ($rootScope.friends) {
          $rootScope.notifications.push(data.notification);
          $rootScope.hasNewNotifications ++;

          $rootScope.friends[data.notification.senderUserHash].unread ++;
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

    $rootScope.toggleSettings = function () {
      if ($rootScope.settings) {
        $rootScope.settings = false;
      } else {
        $rootScope.settings = true;
      }
    };

    var email = localStorage.getItem('personaEmail');

    if (email) {
      $rootScope.isAuthenticated = true;
    }

    $rootScope.login = function () {
      persona.login();
    };

    $rootScope.logout = function () {
      persona.logout();
    }
  }).
  controller('HomeCtrl', function ($scope, $rootScope, $location) {

  }).
  controller('FriendCtrl', function ($scope, $rootScope, $http, $location, api) {
    $scope.showMessage = false;
    $scope.users = [];
    $scope.user = '';

    api.call();

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
      var verify = confirm('Are you sure you want to unfriend ' + $rootScope.friends[user].username + '? :(');

      if (verify) {
        $http({
          url: '/api/friend/' + user,
          method: 'DELETE'
        }).success(function (data) {
          delete $rootScope.friends[user];
          $scope.info = data.message;
        }).error(function (data) {
          $scope.errors = data.message;
        });
      }
    };

    $scope.requestFriend = function (user) {
      $http({
        url: '/api/friend',
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
          $scope.errors = data.message;
        });
      } else {
        $scope.users = [];
      }
    };
  }).
  controller('BlockedCtrl', function ($scope, $rootScope, $http, $location, api) {
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

  }).
  controller('DashboardCtrl', function ($scope, $rootScope, $http, $location, api) {
    $rootScope.hasNewNotifications = 0;

    api.call();

    var videoShooter;
    var gumHelper = new GumHelper({});
    var preview = $('#video-preview');
    $scope.recipients = {};
    $scope.showMessage = false;
    $scope.posting = false;
    $scope.picture = '';
    $scope.selectedFriend = false;
    $scope.recipientArr = [];

    $rootScope.hasNewNotifications = 0;
    $rootScope.notifications = [];

    var escapeHtml = function (text) {
      if (text) {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
    };

    var getScreenshot = function (callback, numFrames, interval) {
      if (videoShooter) {
        videoShooter.getShot(callback, numFrames, interval);
      } else {
        callback('');
      }
    };

    var resetForm = function () {
      $scope.recipients = {};
      $scope.recipientArr = [];
      $scope.errors = false;
      $scope.message = '';
      $scope.picture = '';
      preview.empty();
      videoShooter = null;
    };

    $scope.selectedFriend = function (friend) {
      return $scope.selectedFriend === friend.userHash;
    };

    $scope.promptCamera = function () {
      if ($rootScope.isAuthenticated && navigator.getMedia) {
        gumHelper.startVideoStreaming(function (err, data) {
          if (err) {
            console.log(err);
          } else {

            data.videoElement.width = data.stream.width / 5;
            data.videoElement.height = data.stream.height / 5;
            preview.append(data.videoElement);
            data.videoElement.play();
            videoShooter = new VideoShooter(data.videoElement);
          }
        });
      }
    };

    $scope.deleteMessage = function (message, idx) {
      var verify = confirm('Are you sure you want to delete this message? :(');

      if (verify) {
        $http({
          url: '/api/message/' + $scope.selectedFriend + '/' + message.key,
          method: 'DELETE'
        }).success(function (data) {
          $rootScope.messages.splice(idx, 1);
          $scope.info = data.message;
        }).error(function (data) {
          $scope.errors = data.message;
        });
      }
    };

    $scope.getMessages = function (friend) {
      $rootScope.messages = [];
      $scope.selectedFriend = friend.userHash;
      $rootScope.hasNewNotifications = 0;
      $rootScope.notifications = [];
      $rootScope.friends[friend.userHash].unread = 0;

      $http({
        url: '/api/messages/' + friend.userHash,
        method: 'GET'
      }).success(function (data) {
        $rootScope.messages = data.chats;
        $scope.errors = false;
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
      });
    };

    $scope.toggleRecipient = function (userHash) {
      if ($scope.recipients[userHash]) {
        delete $scope.recipients[userHash];
      } else {
        $scope.recipients[userHash] = userHash;
      }
    };

    $scope.toggleMessage = function () {
      resetForm();

      if ($scope.showMessage) {
        $scope.showMessage = false;
      } else {
        $scope.showMessage = true;
      }
    };

    $scope.sendMessage = function () {
      for (var r in $scope.recipients) {
        $scope.recipientArr.push(r);
      }

      getScreenshot(function (pictureData) {
        $scope.picture = pictureData;

        $http({
          url: '/api/message',
          data: {
            message: escapeHtml($scope.message),
            picture: escapeHtml($scope.picture),
            recipients: $scope.recipientArr
          },
          method: 'POST'
        }).success(function (data) {
          $scope.info = data.message;
          resetForm();
        }).error(function (data) {
          $scope.info = false;
          $scope.errors = data.message;
        });
      }, 10, 0.2);
    };
  }).
  controller('ProfileCtrl', function ($scope, $rootScope, $http, $location) {
    $scope.setUsername = false;
    $scope.currentUsername = $rootScope.username;

    $scope.updateProfile = function () {
      $http({
        url: '/api/profile',
        data: {
          username: $scope.username
        },
        method: 'PUT'
      }).success(function (data) {
        $scope.errors = false;
        $scope.info = data.message;
        $rootScope.username = data.username;
        $scope.username = $scope.currentUsername = data.username;
        $scope.setUsername = true;
      }).error(function (data) {
        $scope.setUsername = false;
        $scope.info = false;
        $scope.errors = data.message;
      });
    };
  });
