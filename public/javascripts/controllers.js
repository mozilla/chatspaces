'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl', function ($scope, authenticate, $rootScope, $http, $location, $routeParams, user) {
    user.call();
    $rootScope.friendPredicate = '-username';
    $rootScope.recipients = {};

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
        var senderKey = data.value.reply || data.value.senderKey;

        if ($location.path() === '/dashboard' || $routeParams.senderKey === senderKey) {
          $rootScope.messages.unshift(data);
          $rootScope.recipients = {};

          if ($routeParams.senderKey === senderKey) {
            data.value.recipients.forEach(function (userHash) {
              $rootScope.recipients[userHash] = userHash;
            });

            $rootScope.reply = senderKey;
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
  controller('MessageCtrl', function ($scope, $rootScope, $http, $routeParams, $location, gumhelper, api) {
    api.call();

    $rootScope.messages = [];

    var resetForm = function () {
      if (!$routeParams.senderKey) {
        $rootScope.recipients = {};
        $rootScope.reply = false;
      }
      $scope.recipientArr = [];
      $scope.errors = false;
      $scope.message = '';
      $scope.picture = '';
      $scope.preview = '';
      $scope.posting = false;
      $('#video-preview').empty();
      gumhelper.resetStream();
    };

    var escapeHtml = function (text) {
      if (text) {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
    };

    resetForm();

    $rootScope.notifications.splice($rootScope.notifications.indexOf($routeParams.senderKey), 1);

    if ($rootScope.hasNewNotifications < 0) {
      $rootScope.hasNewNotifications = 0;
    }

    if ($routeParams.senderKey) {
      $http({
        url: '/api/thread/' + $routeParams.senderKey,
        method: 'GET'
      }).success(function (data) {
        $scope.isLoading = false;
        $scope.errors = false;
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
      });
    }

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

        for (var r in $rootScope.recipients) {
          $scope.recipientArr.push(r);
        }

        gumhelper.startScreenshot(function (pictureData) {
          $scope.picture = pictureData;

          var formData = {
            message: escapeHtml($scope.message),
            picture: escapeHtml($scope.picture),
            recipients: $scope.recipientArr
          };

          if ($rootScope.reply) {
            formData.reply = $rootScope.reply;
          }

          $http({
            url: '/api/message',
            data: formData,
            method: 'POST'
          }).success(function (data) {
            resetForm();
            console.log('got here1')

            if (!$routeParams.senderKey) {
              $location.path('/thread/' + data.key);
            }
          }).error(function (data) {
            $scope.info = false;
            $scope.errors = data.message;
            $scope.posting = false;
          });
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

    $http({
      url: '/api/feed',
      method: 'GET'
    }).success(function (data) {
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
      if (message.value.reply) {
        $location.path('/thread/' + message.value.reply);
      } else {
        $location.path('/thread/' + message.key);
      }
    };
  }).
  controller('ProfileCtrl', function ($scope, $rootScope, $http, $location) {
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
        $rootScope.username = $scope.username = $scope.currentUsername = data.username;
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
      });
    };
  });
