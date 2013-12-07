'use strict';

angular.module('chatspace.factories', []).
  factory('authenticate', function ($rootScope, $http, $location, $window, user) {
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
    var svg = $(null);

    var progressCircleTo = function (progressRatio) {
      var circle = $('path#arc');

      var thickness = 25;
      var angle = progressRatio * (360 + thickness); // adding thickness accounts for overlap
      var offsetX = 256 / 2;
      var offsetY = 128 / 2;
      var radius = offsetY - (thickness / 2);

      var radians = (angle / 180) * Math.PI;
      var x = offsetX + Math.cos(radians) * radius;
      var y = offsetY + Math.sin(radians) * radius;
      var d;

      if (progressRatio === 0) {
        d = 'M0,0 M ' + x + ' ' + y;
      } else {
        d = circle.attr('d') + ' L ' + x + ' ' + y;
      }
      circle.attr('d', d).attr('stroke-width', thickness);
    };

    var getScreenshot = function (callback, progressCallback, numFrames, interval) {
      if (videoShooter) {
        svg.attr('class', 'progress visible');
        videoShooter.getShot(callback, progressCallback, numFrames, interval);
      } else {
        callback('');
      }
    };

    var startStream = function () {
      GumHelper.startVideoStreaming(function (err, stream, videoElement, width, height) {
        if (err) {
          console.log(err);
        } else {

          svg = $('<svg class="progress" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 256 128" preserveAspectRatio="xMidYMid" hidden><path d="M0,0 " id="arc" fill="none" stroke="rgba(87,223,180,0.9)"></svg>');

          // TODO: use the provided width and height to determine
          // smaller dimensions with proper aspect ratio
          videoElement.width = 120;
          videoElement.height = 90;
          $('#video-preview').append(svg)
                             .append(videoElement); // TODO: switch to directive
          videoElement.play();
          videoShooter = new VideoShooter(videoElement);
        }
      });
    };

    var startScreenshot = function (callback) {
      progressCircleTo(0);

      svg.attr('class', 'progress visible');

      getScreenshot(function (pictureData) {
        svg.attr('class', 'progress');
        callback(pictureData);
      }, function (progress) {
        progressCircleTo(progress);
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
  factory('localCache', function ($rootScope) {
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

        localForage.getItem($rootScope.userHash + ':dashboard', function (messages) {
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

          localForage.setItem($rootScope.userHash + ':dashboard', messages);
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
