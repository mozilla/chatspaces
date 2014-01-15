'use strict';

angular.module('chatspace.controllers', []).
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

    var email = localStorage.getItem('personaEmail');

    if (email) {
      $rootScope.isAuthenticated = true;
    }

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
  }).
  controller('HomeCtrl', function ($scope, $rootScope, $location, authenticate) {
    $scope.login = function () {
      authenticate.login();
      $rootScope.toggleSettings();
    };
  }).
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
          $scope.hasMessages = true;
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
  }).
  controller('DraftsCtrl', function ($scope, $rootScope, $location, $http) {
    $scope.draftMessages = {};
    $scope.draftList = [];

    $http({
      url: '/api/profile',
      method: 'GET'
    }).success(function (data) {
      $rootScope.userHash = data.userHash;

      localForage.getItem($rootScope.userHash + ':draftList', function (drafts) {
        if (drafts) {
          $scope.draftList = drafts;

          drafts.forEach(function (d) {
            localForage.getItem($rootScope.userHash + ':draft[' + d + ']', function (message) {
              $scope.$apply(function () {
                $scope.draftMessages[d] = message;
              });
            });
          });
        }
      });
    });

    $scope.resendMessage = function (message) {
      $http({
        url: '/api/message',
        data: message.value,
        method: 'POST'
      }).success(function (data) {
        localForage.setItem($rootScope.userHash + ':lastPic', message.value.picture);
        delete $scope.draftMessages[message.key];
        $scope.draftList.splice($scope.draftList.indexOf(message.key), 1);

        localForage.removeItem($rootScope.userHash + ':draft[' + message.key + ']');
        localForage.setItem($rootScope.userHash + ':draftList', $scope.draftList);
      }).error(function () {
        console.log('could not send, keeping in drafts');
      });
    };
  }).
  controller('FriendCtrl', function ($scope, $rootScope, $http, $location, $translate, api) {
    api.call();

    $scope.users = [];
    $scope.user = '';
    $scope.showNewMessageGuide = true;

    localForage.getItem('newMessage', function (st) {
      if (st) {
        $scope.showNewMessageGuide = false;
      }
    });

    $scope.goToDashboard = function () {
      $location.path('/dashboard');
    };

    $scope.blockUser = function (userHash) {
      $http({
        url: '/api/block',
        data: {
          userHash: userHash
        },
        method: 'POST'
      }).success(function (data) {
        $scope.info = $translate('BLOCKED_USER');
        delete $rootScope.friends[userHash];
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = $translate('ERROR_COULD_NOT_BLOCK_USER');
      });
    };

    $scope.deleteFriend = function (user) {
      $http({
        url: '/api/unfollow/' + user,
        method: 'DELETE'
      }).success(function (data) {
        delete $rootScope.friends[user];
        $scope.info = $translate('UNFOLLOWED_USER');
      }).error(function (data) {
        $scope.errors = $translate('ERROR_COULD_NOT_UNFOLLOW_USER');
      });
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
        $scope.info = $translate('ADDED_USER');
      }).error(function (data) {
        $scope.errors = $translate('ERROR_COULD_NOT_FOLLOW_USER');
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
          $scope.errors = $translate('ERROR_COULD_NOT_SEARCH_USERS');
        });
      } else {
        $scope.users = [];
      }
    };
  }).
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
  }).
  controller('DashboardCtrl', function ($scope, $rootScope, $http, $location, $routeParams, api) {
    api.call();

    $http({
      url: '/api/profile',
      method: 'GET'
    }).success(function (data) {
      $rootScope.userHash = data.userHash;
      $rootScope.recipients = {};
      $rootScope.messages = {};
      $rootScope.recipientAvatars = {};
      $scope.isLoading = true;

      var recipientAvatars = [];

      var since = '';

      // load all the messages from the local cache
      localForage.getItem($rootScope.userHash + ':dashboardList', function (data) {
        if (data) {
          $rootScope.dashboardList = data;
        }

        $rootScope.dashboardList.forEach(function (d) {
          // remove any occurences of your own userHash and add the final message to the messages scope
          localForage.getItem($rootScope.userHash + ':dashMessage[' + d + ']', function (thread) {
            recipientAvatars = thread.value.recipientAvatars;

            $rootScope.messages[d] = thread;
            $rootScope.recipientAvatars[d] = thread.value.recipientAvatars || [];
          });
        });

        if ($rootScope.dashboardList[0]) {
          since = '?since=' + $rootScope.dashboardList[0];
        }

        $http({
          url: '/api/feed' + since,
          method: 'GET'
        }).success(function (data) {
          $scope.isLoading = false;
        });
      });
    });

    $scope.isUnread = function (message) {
      var count = 0;

      $rootScope.notifications.forEach(function (n) {
        if (n === message.value.senderKey) {
          count ++;
        }
      });

      return count;
    };

    $scope.getThread = function (message) {
      if (message.value.reply) {
        $location.path('/thread/' + message.value.reply);
      } else {
        $location.path('/thread/' + message.key);
      }
    };
  }).
  controller('ProfileCtrl', function ($scope, $rootScope, $http, $location, $translate, cameraHelper) {
    $scope.currentUsername = $rootScope.username;
    $scope.cacheInfo = false;
    $scope.selectedUsername = false;

    localForage.getItem('newUser', function (st) {
      if (!st) {
        $location.path('/profile');
      }
    });

    $scope.resetCache = function () {
      localForage.clear();
      $rootScope.latestMessage = false;
      $scope.cacheInfo = $translate('LOCAL_CACHE_RESET');
    };

    $scope.updateAvatar = function () {
      cameraHelper.startScreenshot(1, 0, function (pictureData) {
        $scope.$apply(function () {
          $rootScope.avatar = pictureData;
        });
      });
    };

    $scope.saveAvatar = function () {
      $scope.updateProfile(function () {
        $scope.selectedUsername = true;
        $scope.cancelCamera();
      });
    };

    $scope.searchFriends = function () {
      // new user is flagged as existing user once they go through the username and avatar process
      localForage.setItem('newUser', false);
      $location.path('/search');
    };

    $scope.saveUsername = function () {
      $scope.updateProfile(function () {
        $scope.promptCamera();
      });
    };

    $scope.updateProfile = function (callback) {
      $http({
        url: '/api/profile',
        data: {
          username: $scope.username,
          avatar: $rootScope.avatar
        },
        method: 'PUT'
      }).success(function (data) {
        $scope.errors = false;
        $rootScope.username = $scope.username = $scope.currentUsername = data.username;

        if (callback) {
          callback();
        }
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = $translate('ERROR_USERNAME_TAKEN');
      });
    };
  });
