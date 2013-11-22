'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl', function ($scope, authenticate, $rootScope, $http, $location, $routeParams, user) {
    user.call();
    $rootScope.friendPredicate = '-username';

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
        if (data && $rootScope.notifications.indexOf(data) === -1) {
          $rootScope.notifications.push(data);
        }
      });
    });

    socket.on('message', function (data) {
      $rootScope.$apply(function () {
        if ($location.path() === '/dashboard' || $routeParams.senderKey === data.key.split('!')[1]) {
          $rootScope.messages.unshift(data);
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

    $rootScope.getDate = function (timestamp) {
      return moment.unix(Math.round(timestamp / 1000)).fromNow();
    };

    $rootScope.goToDashboard = function () {
      $location.path('/dashboard');
    };

    $rootScope.toggleSettings = function () {
      if ($rootScope.settings) {
        $rootScope.settings = false;
      } else {
        $rootScope.settings = true;
      }
    };

    $rootScope.newMessage = function () {
        $rootScope.settings = false;
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
  controller('MessageCtrl', function ($scope, $rootScope, $http, $location, gumhelper, api) {
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
            $location.path('/thread/' + data.key);

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
          url: '/api/unfollow/' + user,
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

    $scope.isLoading = true;
    $rootScope.messages = [];

    // TODO: switch to websockets
    $http({
      url: '/api/feed',
      method: 'GET'
    }).success(function (data) {
      $rootScope.messages = data.chats;
      $scope.isLoading = false;
      $scope.errors = false;
    }).error(function (data) {
      $scope.info = false;
      $scope.errors = data.message;
    });

    $scope.isUnread = function (message) {
      return !!(($rootScope.notifications.indexOf(message.value.reply) > -1) ||
               ($rootScope.notifications.indexOf(message.value.senderKey) > -1));
    };

    $scope.getThread = function (message) {
      message.value.recipients.push(message.key.split('!')[1])
      var recipients = message.value.recipients;

      if (message.value.reply) {
        $location.path('/thread/' + message.value.reply);
      } else {
        $location.path('/thread/' + message.key);
      }
    };
  }).
  controller('ThreadCtrl', function ($scope, $rootScope, $http, $location, $routeParams, api) {
    api.call();

    $scope.isLoading = true;
    $rootScope.messages = [];
    $rootScope.notifications.splice($rootScope.notifications.indexOf($routeParams.senderKey), 1);

    if ($rootScope.hasNewNotifications < 0) {
      $rootScope.hasNewNotifications = 0;
    }

    // TODO: switch to websockets
    $http({
      url: '/api/thread/' + $routeParams.senderKey,
      method: 'GET'
    }).success(function (data) {
      $rootScope.messages = data.chats;
      $scope.isLoading = false;
      $scope.errors = false;
    }).error(function (data) {
      $scope.info = false;
      $scope.errors = data.message;
    });
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
