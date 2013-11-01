'use strict';

angular.module('chatspace.controllers', []).
  controller('AppCtrl', function ($scope, persona, $rootScope, $http, $location) {
    $rootScope.isAuthenticated = false;
    $rootScope.settings = false;
    $rootScope.friends = {};
    $rootScope.messages = {};

    var settingsView = $('main');

    socket.on('connect', function () {
      socket.on('friend', function (data) {
        $scope.$apply(function () {
          $rootScope.friends[data.friend.username] = data.friend.avatar;
        });
      });

      socket.on('message', function (data) {
        $scope.$apply(function () {
          $rootScope.messages[data.chat.value.created] = data.chat.value;
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

    $http({
      url: '/api/friends',
      method: 'GET'
    });

    $scope.deleteFriend = function (user) {
      console.log(user)
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
    var preview = $('#video-preview');
    $scope.recipients = {};

    $http({
      url: '/api/friends',
      method: 'GET'
    });

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

    // lazy "always" prompt for now until we figure out the correct behaviour
    if ($rootScope.isAuthenticated && navigator.getMedia) {
      GumHelper.startVideoStreaming(function errorCb(err) {

        console.log('error ', err)
      }, function successCallback(stream, videoElement, width, height) {

        videoElement.width = width / 5;
        videoElement.height = height / 5;
        preview.append(videoElement);
        videoElement.play();
        videoShooter = new VideoShooter(videoElement);
      });
    }

    $scope.getMessages = function (username, idx) {
      $rootScope.messages = [];
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

    $scope.addRecipient = function (user) {
      $scope.recipients[user] = user;
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
