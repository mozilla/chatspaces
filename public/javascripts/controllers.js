'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl', function ($scope, persona, $rootScope, $http, $location) {
    $rootScope.isAuthenticated = false;
    $rootScope.settings = false;
    $rootScope.friends = {};
    $rootScope.messages = {};
    $rootScope.currentFriend;

    var settingsView = $('main');

    $rootScope.getFriends = function () {
      $http({
        url: '/api/friends',
        method: 'GET'
      });
    };

    socket.on('connect', function () {
      socket.on('friend', function (data) {
        $scope.$apply(function () {
          $rootScope.friends[data.friend.userHash] = {
            username: data.friend.username,
            avatar: data.friend.avatar,
            userHash: data.friend.userHash
          };
        });
      });

      socket.on('message', function (data) {
        $scope.$apply(function () {
          console.log(data)
          $rootScope.messages[data.chat.value.senderKey] = data.chats;
        });
      });
    });

    $rootScope.isValidUser = function () {
      if (!($rootScope.isAuthenticated || $rootScope.username)) {
        $location.path('/');
      }
    };

    $rootScope.checkLogin = function () {
      $rootScope.isValidUser();

      $http({
        url: '/api/profile',
        method: 'GET'
      }).success(function (data) {
        $rootScope.email = data.email;
        $rootScope.username = data.username;
        $rootScope.gravatar = data.gravatar;
        $rootScope.userHash = data.userHash;

        socket.emit('join', {
          email: data.email
        });
      }).error(function (data) {

        $rootScope.email = data.email;
        $rootScope.gravatar = data.gravatar;
      });
    };

    $rootScope.toggleSettings = function () {
      if ($rootScope.settings) {
        $rootScope.settings = false;
        settingsView.removeClass('on').addClass('off');
      } else {
        $rootScope.settings = true;
        settingsView.removeClass('off').addClass('on');
      }
    };

    var email = localStorage.getItem('personaEmail');

    if (email) {
      $rootScope.isAuthenticated = true;
    }

    $rootScope.checkLogin();

    $rootScope.login = function () {
      persona.login();
    };

    $rootScope.logout = function () {
      persona.logout();
    }
  }).
  controller('HomeCtrl', function ($scope, $rootScope, $location) {
    if ($rootScope.isAuthenticated) {
      $rootScope.getFriends();

      if (!$rootScope.username) {
        $location.path('/profile');
      } else {
        $location.path('/dashboard');
      }
    }
  }).
  controller('FriendCtrl', function ($scope, $rootScope, $http, $location) {
    $rootScope.checkLogin();

    if (!$rootScope.username) {
      $location.path('/profile');
    }

    $scope.showMessage = false;
    $scope.users = [];
    $scope.user = '';

    $rootScope.getFriends();

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
      var verify = confirm('Are you sure you want to unfriend ' + user + '? :(');

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
  controller('BlockedCtrl', function ($scope, $rootScope, $http, $location) {
    if (!$rootScope.isAuthenticated) {
      $location.path('/');
    }

    if (!$rootScope.username) {
      $location.path('/profile');
    }

    $scope.blocked = {};

    socket.on('connect', function () {
      socket.on('blocked', function (data) {
        $scope.$apply(function () {
          $scope.blocked[data.user.userHash] = {
            username: data.user.username,
            avatar: data.user.avatar,
            userHash: data.user.userHash
          };
        });
      });
    });

    $http({
      url: '/api/blocked',
      method: 'GET'
    }).success(function (data) {

    }).error(function (data) {
      $scope.errors = data.message;
    });

    $scope.unblockUser = function (userHash, idx) {
      $http({
        url: '/api/block/' + userHash,
        method: 'DELETE'
      }).success(function (data) {
        delete $scope.blocked[userHash];
      }).error(function (data) {
        $scope.errors = data.message;
      });
    };

  }).
  controller('DashboardCtrl', function ($scope, $rootScope, $http, $location) {
    if (!$rootScope.isAuthenticated) {
      $location.path('/');
    }

    if (!$rootScope.username) {
      $location.path('/profile');
    }

    var videoShooter;
    var gumHelper = new GumHelper({});
    var preview = $('#video-preview');
    var recipientList = $('.recipient-results li');
    $scope.recipients = {};

    $rootScope.getFriends();

    $scope.showMessage = false;
    $scope.posting = false;

    var newMessageForm = $('.message');

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

    $scope.deleteMessage = function (key, idx) {
      var verify = confirm('Are you sure you want to delete this message? :(');

      if (verify && $rootScope.currentFriend) {
        $http({
          url: '/api/message/' + $rootScope.currentFriend + '/' + key,
          method: 'DELETE'
        }).success(function (data) {
          $('#message-list li')[idx].remove();
          $scope.info = data.message;
        }).error(function (data) {
          $scope.errors = data.message;
        });
      }
    };

    $scope.getMessages = function (userHash, idx) {
      $rootScope.messages = {};
      $rootScope.currentFriend = userHash;
      $('#friend-results li').removeClass('on');
      $('#friend-results li')[idx].className = 'on';

      $http({
        url: '/api/messages/' + userHash,
        method: 'GET'
      }).success(function (data) {
        $rootScope.messages = data.chats;
        $scope.errors = false;
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
      });
    };

    $scope.toggleRecipient = function (userHash, idx) {
      if ($scope.recipients[userHash]) {
        $('.recipient-results li')[idx].className = '';
        delete $scope.recipients[userHash];
      } else {
        $('.recipient-results li')[idx].className = 'on';
        $scope.recipients[userHash] = userHash;
      }
    };

    $scope.toggleMessage = function () {
      $scope.errors = false;
      $scope.info = false;

      if ($scope.showMessage) {
        $scope.showMessage = false;
        $scope.message = '';
        $scope.picture = '';
        newMessageForm.removeClass('on');
      } else {
        $scope.showMessage = true;
        newMessageForm.addClass('on');
      }
    };

    $scope.sendMessage = function () {
      var recipientArr = [];

      for (var r in $scope.recipients) {
        recipientArr.push(r);
      }

      getScreenshot(function (pictureData) {
        $http({
          url: '/api/message',
          data: {
            message: escapeHtml($scope.message),
            picture: escapeHtml(pictureData),
            recipients: recipientArr
          },
          method: 'POST'
        }).success(function (data) {
          $scope.recipients = {};
          $scope.errors = false;
          $scope.info = data.message;
          $scope.message = '';
          $scope.picture = '';
        }).error(function (data) {
          $scope.info = false;
          $scope.errors = data.message;
        });
      }, 10, 0.2);
    };
  }).
  controller('ProfileCtrl', function ($scope, $rootScope, $http, $location) {
    if (!$rootScope.isAuthenticated) {
      $location.path('/');
    } else {
      $rootScope.checkLogin();
    }

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
        $scope.info = false;
        $scope.errors = data.message;
      });
    };
  });
