angular.module('chatspaces.factories', []).
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
            $rootScope.avatar = data.avatar;

            if (data.username) {
              location.reload();
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
        videoElement.width = 100;
        videoElement.height = 75;
        $('#video-preview').append(svg)
                           .append(videoElement); // TODO: switch to directive
        videoElement.play();
        videoShooter = new VideoShooter(videoElement);
      }
    });
  };

  var startScreenshot = function (frames, seconds, callback) {
    progressCircleTo(0);

    svg.attr('class', 'progress visible');

    getScreenshot(function (pictureData) {
      svg.attr('class', 'progress');
      callback(pictureData);
    }, function (progress) {
      progressCircleTo(progress);
    }, frames, seconds);
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
  var setItem = function (key, value) {
    var dashboardKey = $rootScope.userHash + ':dashboardList';
    var threadKey = $rootScope.userHash + ':threadList[' + key + ']';
    var dashMessage = $rootScope.userHash + ':dashMessage[' + key + ']';
    $rootScope.dashboardList = [];
    $rootScope.threadList = [];
    var maxMessageCount = 30;

    if (value.value.reply) {
      // save the latest to the dashboard
      localForage.getItem(dashMessage, function (data) {
        if (data) {
          data.value.key = key;

        } else {
          data = value;
          value.key = key;
        }

        data.value.message = value.value.message;
        data.value.media = value.value.media;
        data.updated = value.value.created;
        localForage.setItem(dashMessage, value);
      });
    } else {
      localForage.setItem(dashMessage, value);
    }

    localForage.getItem(dashboardKey, function (data) {
      if (data) {
        $rootScope.dashboardList = data;
      }

      $rootScope.dashboardList.unshift(key);

      for (var i = maxMessageCount; i < $rootScope.dashboardList.length; i ++) {
        localForage.removeItem($rootScope.userHash + ':threadList[' + $rootScope.dashboardList[i] + ']');
        localForage.removeItem($rootScope.userHash + ':dashMessage[' + $rootScope.dashboardList[i] + ']');
        $rootScope.dashboardList.splice(i, 1);
      }
      localForage.setItem(dashboardKey, $rootScope.dashboardList);
    });

    localForage.getItem(threadKey, function (data) {
      if (data) {
        $rootScope.threadList = data;
      }

      $rootScope.threadList.unshift(value.key);
      localForage.setItem(threadKey, $rootScope.threadList);
    });
  };

  return {
    setItem: setItem
  };
}).
factory('socket', function (socketFactory) {
  return socketFactory();
});
