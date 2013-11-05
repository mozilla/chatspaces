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
          $rootScope.friends[data.friend.username] = data.friend.avatar;
        });
      });

      socket.on('message', function (data) {
        $scope.$apply(function () {
          $rootScope.messages[data.chat.value.senderKey] = data.chat.value;
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
  controller('FriendCtrl', function ($scope, $rootScope, $http) {
    $rootScope.checkLogin();
    $scope.showMessage = false;
    $scope.users = [];
    $scope.user = '';

    $rootScope.getFriends();

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
          username: user.username
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
  controller('DashboardCtrl', function ($scope, $rootScope, $http) {
    if (!$rootScope.isAuthenticated) {
      $location.path('/');
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

   // $scope.promptCamera = function () {
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
 //   };

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

    $scope.getMessages = function (username, idx) {
      $rootScope.messages = {};
      $rootScope.currentFriend = username;
      $('#friend-results li').removeClass('on');
      $('#friend-results li')[idx].className = 'on';

      $http({
        url: '/api/messages/' + username,
        method: 'GET'
      }).success(function (data) {
        $rootScope.messages = data.chats;
        $scope.errors = false;
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
      });
    };

    $scope.toggleRecipient = function (user, idx) {
      console.log(recipientList)
      if ($scope.recipients[user]) {
        $('.recipient-results li')[idx].className = '';
        delete $scope.recipients[user];
      } else {
        $('.recipient-results li')[idx].className = 'on';
        $scope.recipients[user] = user;
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
          body.find('> img').remove();
        }).error(function (data) {
          $scope.info = false;
          $scope.errors = data.message;
          body.find('> img').remove();
        });
      }, 10, 0.2);
    };
  }).
  controller('ProfileCtrl', function ($scope, $rootScope, $http, $location) {
    $scope.currentUsername = $rootScope.username;

    if (!$rootScope.isAuthenticated) {
      $location.path('/');
    } else {
      $rootScope.checkLogin();
    }

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
      }).error(function (data) {
        $scope.info = false;
        $scope.errors = data.message;
      });
    };
  });
