'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl', function ($scope, authenticate, $rootScope, $http, $location, user) {
    user.call();

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
      setTimeout(function () {
        $rootScope.$apply(function () {
          $rootScope.notifications.push(data.notification);
          $rootScope.hasNewNotifications ++;
          if ($rootScope.selectedFriend !== data.notification.senderUserHash) {
            $rootScope.friends[data.notification.senderUserHash].unread ++;
          }
        });
      }, 500);
    });

    socket.on('message', function (data) {
      setTimeout(function () {
        $rootScope.$apply(function () {
          if ($rootScope.selectedFriend === data.key.split('!')[1]) {
            $rootScope.messages.unshift(data);
          }
        });
      }, 500);
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

    $rootScope.goToDashboard = function () {
      $rootScope.hasNewNotifications = 0;
      $location.path('/dashboard');
    };

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

    $rootScope.logout = function () {
      authenticate.logout();
    }
  }).
  controller('HomeCtrl', function ($scope, $rootScope, $location, authenticate) {
    $scope.login = function () {
      authenticate.login();
      $rootScope.toggleSettings();
    };
  }).
  controller('MessageCtrl', function ($scope, $rootScope, $http, gumhelper, api) {
    $scope.recipients = {};
    $scope.posting = false;
    $scope.picture = '';
    $scope.recipientArr = [];
    $scope.isLoading = false;

    api.call();

    var escapeHtml = function (text) {
      if (text) {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
    };

    var resetForm = function () {
      $scope.recipients = {};
      $scope.recipientArr = [];
      $scope.errors = false;
      $scope.message = '';
      $scope.picture = '';
      $scope.preview = '';
      $scope.posting = false;
      $('#video-preview').empty();
      gumhelper.resetStream();
    };

    $scope.promptCamera = function () {
      if ($rootScope.isAuthenticated && navigator.getMedia) {
        gumhelper.startStream();
      }
    };

    $scope.toggleRecipient = function (userHash) {
      if ($scope.recipients[userHash]) {
        delete $scope.recipients[userHash];
      } else {
        $scope.recipients[userHash] = userHash;
      }
    };

    $scope.sendMessage = function () {
      if (!$scope.posting) {
        $scope.posting = true;

        for (var r in $scope.recipients) {
          $scope.recipientArr.push(r);
        }

        var submitForm = function (pictureData) {
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
            $scope.posting = false;
          });
        };

        gumhelper.startScreenshot(function (pictureData) {
          submitForm(pictureData);
        });
      }
    };
  }).
  controller('DraftsCtrl', function ($scope, $rootScope, $location) {

  }).
  controller('FriendCtrl', function ($scope, $rootScope, $http, $location, api) {
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
    api.call();

    $rootScope.hasNewNotifications = 0;
    $rootScope.notifications = [];

    $scope.getDate = function (timestamp) {
      return moment.unix(Math.round(timestamp / 1000)).fromNow();
    };

    $scope.deleteMessage = function (message, idx) {
      $rootScope.messages.splice(idx, 1);
      $http({
        url: '/api/message/' + $rootScope.selectedFriend + '/' + message.key,
        method: 'DELETE'
      }).success(function (data) {

      }).error(function (data) {
        $scope.errors = data.message;
      });
    };

    $scope.getMessages = function (friend) {
      $scope.isLoading = true;
      $rootScope.messages = [];
      $rootScope.selectedFriend = friend.userHash;
      $rootScope.hasNewNotifications = 0;
      $rootScope.notifications = [];
      $rootScope.friends[friend.userHash].unread = 0;

      $http({
        url: '/api/messages/' + friend.userHash,
        method: 'GET'
      }).success(function (data) {
        $rootScope.messages = data.chats;
        $scope.isLoading = false;
        $scope.errors = false;
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
      });
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
