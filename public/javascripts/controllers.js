'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl',
    function ($scope, authenticate, $rootScope, $http, $location, $routeParams, user, localCache) {

    user.call();
    $rootScope.friendPredicate = '-username';
    $rootScope.recipients = {};
    $rootScope.latestMessage;
    $rootScope.latestThreadMessage;

    if ($rootScope.isAuthenticated) {
      localForage.getItem($rootScope.userHash + ':latestMessageKey', function (key) {
        $rootScope.latestMessage = key;
      });
    }

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

          $rootScope.messages[data.key] = data;

          // also save message to local cache
          data.updated = data.value.created;

          localCache.setItem($rootScope.userHash + ':dashboard', data, true, function () {
            console.log('saved dashboard');
          });

          localCache.setItem($rootScope.userHash + ':thread[' + key + ']', data, false, function () {
            console.log('saved thread');
          });

          localForage.setItem($rootScope.userHash + ':latestMessageKey', data.key); // last one at the top is the latest dashboard key

          $rootScope.latestMessage = data.key;
          $rootScope.recipients = {};

          if ($routeParams.senderKey === senderKey) {
            $rootScope.latestThreadMessage = data.key; // last one at the top is the latest thread key
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

    $rootScope.loadDashboard = function () {
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

    $rootScope.getDate = function (timestamp) {
      return moment.unix(Math.round(timestamp / 1000)).fromNow();
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
  controller('MessageCtrl', function ($scope, $rootScope, $http, $routeParams, $location, cameraHelper, api) {
    api.call();

    var since = '';

    $rootScope.messages = {};
    $scope.formDate = {};
    $scope.showCamera = false;

    var resetForm = function () {
      if (!$routeParams.senderKey) {
        $rootScope.recipients = {};
        $scope.reply = false;
      }

      $scope.recipientArr = [];
      $scope.errors = false;
      $scope.message = '';
      $scope.picture = '';
      $scope.preview = '';
      $scope.posting = false;
      $scope.showCamera = false;
      $scope.showFollowing = false;
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
        $scope.errors = data.message;
      });
    };

    resetForm();

    if ($rootScope.hasNewNotifications < 0) {
      $rootScope.hasNewNotifications = 0;
    }

    if ($routeParams.senderKey) {
      $rootScope.notifications.splice($rootScope.notifications.indexOf($routeParams.senderKey), 1);

      $rootScope.recipients = {};
      $rootScope.reply = $routeParams.senderKey;

      localForage.getItem($rootScope.userHash + ':thread[' + $routeParams.senderKey + ']', function (data) {
        if (data) {
          data.forEach(function (d) {
            $rootScope.messages[d.key] = d;

            d.value.recipients.forEach(function (userHash) {
              $rootScope.recipients[userHash] = userHash;
            });

            $rootScope.latestThreadMessage = d.value.reply || d.key;
          });

          since = '?since=' + $rootScope.latestThreadMessage;

          getThread();
        } else {
          getThread();
        }

        $scope.isLoading = false;
      });
    }

    $scope.promptCamera = function () {
      if ($rootScope.isAuthenticated && navigator.getMedia) {
        $scope.showCamera = true;
        cameraHelper.startStream();
      } else {
        $scope.back();
      }
    };

    $scope.cancelCamera = function () {
      $scope.showCamera = false;
      $scope.showFollowing = false;
      $scope.picture = '';
      $('#video-preview').empty();
      cameraHelper.resetStream();
    };

    $scope.back = function () {
      $scope.showCamera = false;
      $scope.showFollowing = false;
      $('#video-preview').empty();
      cameraHelper.resetStream();
    };

    $scope.recordCamera = function () {
      cameraHelper.startScreenshot(function (pictureData) {
        $scope.$apply(function () {
          $scope.picture = pictureData;
        });
      });
    };

    $scope.showRecipients = function () {
      $scope.back();
      $scope.showFollowing = true;
    };

    $scope.toggleRecipient = function (userHash) {
      if ($rootScope.recipients[userHash]) {
        delete $rootScope.recipients[userHash];
      } else {
        $rootScope.recipients[userHash] = userHash;
      }
    };

    $scope.sendMessage = function () {
      if (!$scope.posting) {
        $scope.posting = true;

        // Also add yourself to the message so you can get replies.
        $rootScope.recipients[$rootScope.userHash] = $rootScope.userHash;

        for (var r in $rootScope.recipients) {
          $scope.recipientArr.push(r);
        }

        var formData = {
          message: escapeHtml($scope.message),
          picture: escapeHtml($scope.picture),
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
          resetForm();

          if (!$routeParams.senderKey) {
            $location.path('/thread/' + data.key);
          }
        }).error(function (data) {
          $scope.info = false;
          $scope.errors = data.message;
          $scope.posting = false;
        });
      }
    };
  }).
  controller('DraftsCtrl', function ($scope, $rootScope, $location) {

  }).
  controller('FriendCtrl', function ($scope, $rootScope, $http, $location, api) {
    api.call();

    $scope.users = [];
    $scope.user = '';

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
  controller('DashboardCtrl', function ($scope, $rootScope, $http, $location, $routeParams, api) {
    api.call();

    $rootScope.messages = {};
    $scope.isLoading = true;

    var since = '';

    // load all the messages from the local cache
    localForage.getItem($rootScope.userHash + ':dashboard', function (data) {
      if (data) {
        console.log(data.length)
        data.forEach(function (d) {
          $rootScope.messages[d.key] = d;
          console.log('********* ', d.key)
          since = '?since=' + d.key;
        });
      }

      $http({
        url: '/api/feed' + since,
        method: 'GET'
      }).success(function (data) {
        $scope.isLoading = false;
      });
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
    $scope.cacheInfo = false;

    $scope.resetCache = function () {
      localForage.clear();
      $rootScope.latestMessage = false;
      $scope.cacheInfo = 'Local cache reset.';
    };

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
