'use strict';

angular.module('chatspace.factories', []).
  factory('authenticate', function ($rootScope, $http, $location, user) {
    var resetUser = function () {
      socket.emit('disconnect', {
        email: $rootScope.email
      });

      $rootScope.username = null;
      localStorage.removeItem('personaEmail');
      user.call();
    };

    var login = function () {
      navigator.id.get(function (assertion) {
        if (!assertion) {
          console.log('No assertion provided');
          return;
        }

        $http({
          url: '/persona/verify',
          method: 'POST',
          data: { assertion: assertion }
        }).
        success(function (data) {

          if (data.status === 'okay') {
            $rootScope.isAuthenticated = true;
            $rootScope.toggleSettings();

            $http({
              url: '/api/profile',
              method: 'GET'
            }).success(function (data) {
              localStorage.setItem('personaEmail', data.email);
              $rootScope.email = data.email;
              $rootScope.username = data.username;
              $rootScope.gravatar = data.gravatar;

              if (data.username) {
                $location.path('/dashboard');
              } else {
                $location.path('/profile');
              }

            }).error(function (data) {

              $location.path('/profile');
            });
          } else {

            resetUser();
            console.log('Login failed');
          }
        }).
        error(function (data) {

          resetUser();
          console.log('Login failed');
        });
      });
    };

    var logout = function () {
      $http({
        url: '/persona/logout',
        method: 'POST'
      }).
      success(function (data) {
        if (data.status === 'okay') {

          $http({
            url: '/api/logout',
            method: 'GET'
          }).success(function (data) {

            resetUser();
            $location.path('/');
          });
        } else {

          console.log('Logout failed because ' + data.reason);
        }
      }).
      error(function (data) {

        console.log('error logging out: ', data);
      });
    };

    return {
      login: login,
      logout: logout
    };
  }).
  factory('gumhelper', function ($rootScope, $http) {
    var videoShooter;
    var gum = new GumHelper({ width: 120, height: 90 });

    var getScreenshot = function (callback, numFrames, interval) {
      if (videoShooter) {
        videoShooter.getShot(callback, numFrames, interval);
      } else {
        callback('');
      }
    };

    var startStream = function () {
      gum.startVideoStreaming(function (err, data) {
        if (err) {
          console.log(err);
        } else {

          data.videoElement.width = data.stream.width;
          data.videoElement.height = data.stream.height;
          $('#video-preview').append(data.videoElement); // TODO: switch to directive
          data.videoElement.play();
          videoShooter = new VideoShooter(data.videoElement);
        }
      });
    };

    var startScreenshot = function (callback) {
      getScreenshot(function (pictureData) {
        callback(pictureData);
      }, 10, 0.2);
    };

    var resetStream = function () {
      videoShooter = null;
    };

    return {
      startScreenshot: startScreenshot,
      startStream: startStream,
      resetStream: resetStream
    };
  });
