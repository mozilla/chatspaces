'use strict';

angular.module('chatspace.factories', []).
  factory('authenticate', function ($rootScope, $http, $location, $window, user, api) {
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
                $window.location.href = '/dashboard';
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
  factory('cameraHelper', function ($rootScope, $http) {
    var videoShooter;

    var getScreenshot = function (callback, numFrames, interval) {
      if (videoShooter) {
        videoShooter.getShot(callback, numFrames, interval);
      } else {
        callback('');
      }
    };

    var startStream = function () {
      GumHelper.startVideoStreaming(function (err, stream, videoElement, width, height) {
        if (err) {
          console.log(err);
        } else {

          // TODO: use the provided width and height to determine
          // smaller dimensions with proper aspect ratio
          videoElement.width = 120;
          videoElement.height = 90;
          $('#video-preview').append(videoElement); // TODO: switch to directive
          videoElement.play();
          videoShooter = new VideoShooter(videoElement);
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
      GumHelper.stopVideoStreaming();
    };

    return {
      startScreenshot: startScreenshot,
      startStream: startStream,
      resetStream: resetStream
    };
  }).
  factory('localCache', function () {
    var checkExisting = function (messages, value) {
      var found = false;

      for (var i = 0; i < messages.length; i ++) {
        if (messages[i].key === value.key) {
          found = true;
          break;
        }
      }

      return found;
    };

    var setItem = function (key, value, isDashboard) {
      // If this is a dashboard item, we want to rewrite the parent conversation
      // thread with the latest message, otherwise we write as is for a new message
      if (isDashboard && value.value.reply) {
        var messageIdx = false;

        localForage.getItem('dashboard', function (messages) {
          if (messages) {
            for (var i = 0; i < messages.length; i ++) {
              if (messages[i].key === value.value.reply) {
                messageIdx = i;
                break;
              }
            }

            messages.splice(messageIdx, 1);
            messages.unshift(value);
          } else {
            messages.unshift(value);
          }

          localForage.setItem('dashboard', messages);
        });
      } else {
        localForage.getItem(key, function (messages) {
          if (messages) {
            if (!checkExisting(messages, value)) {
              messages.unshift(value);
            }
          } else {
            messages = [value];
          }

          localForage.setItem(key, messages);
        });
      }
    };

    return {
      checkExisting: checkExisting,
      setItem: setItem
    };
  });
