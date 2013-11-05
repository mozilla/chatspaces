(function () {
  'use strict';

  var GumHelper = function (opts) {
    var video;
    var cameraStream;
    var videoElement;

    window.url = window.URL || window.webkitURL || window.mozURL || window.msURL;

    navigator.getMedia = navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia ||
                         navigator.msGetUserMedia;

    var numFrames = parseInt(opts.numFrames, 10) || 10;
    var width = parseInt(opts.width, 10) || 640;
    var height = parseInt(opts.height, 10) || 480;

    function streamMedia(callback) {
      navigator.getMedia({ video: true }, function (stream) {
        callback(null, stream);

        if (videoElement.mozSrcObject) {

          videoElement.mozSrcObject = stream;
        } else {

          videoElement.src = window.url.createObjectURL(stream);
        }

        videoElement.play();
      }, function (err) {

        callback(err);
      });
    }

    function findVideoSize(attempts, callback) {
      if (attempts < numFrames) {

        attempts ++;
        setTimeout(function () {
          findVideoSize(attempts, callback);
        }, 200);
      } else {

        callback(null, {
          stream: cameraStream,
          videoElement: videoElement,
          width: width,
          height: height
        });
      }
    }

    /**
     * Requests permission for using the user's camera,
     * starts reading video from the selected camera.
     */
    function startStreaming(callback) {
      var attempts = 0;
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.addEventListener('loadeddata', function () {
        findVideoSize(attempts, callback);
      });

      streamMedia(callback);
    }

    /**
     * Try to initiate video streaming.
     */
    this.startVideoStreaming = function (callback) {
      if (navigator.getMedia) {
        startStreaming(function (err, stream) {
          if (err) {

            callback(err);
          } else {

            // Keep references, for stopping the stream later on.
            cameraStream = stream;
            video = videoElement;

            callback(null, {
              stream: stream,
              videoElement: video
            });
          }
        });
      } else {
        callback(new Error('Could not stream video'));
      }
    };

    this.stopVideoStreaming = function () {
      if (cameraStream) {
        cameraStream.stop();
      }

      if (video) {
        video.pause();
        video.src = null;
        video = null;
      }
    };
  };

  window.GumHelper = GumHelper;
})();
