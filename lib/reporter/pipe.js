'use strict';

/**
 * Pipe is a reporter that pipes the streams of the test to somewhere else,
 * typically stdio (for that, you can simply pass in process to the
 * constructor).
 *
 * This may seem like a stupid and trivial thing, but this is actually a quite
 * important reporter in Overman: Without it, output form tests will be
 * swallowed.
 *
 * @param streams. Of format { stdout: [stream], stderr: [stream] }.
 *     Streams itself is required, but all streams are optional.
 */
function Pipe(streams) {
  this._streams = streams;
}

Pipe.prototype.gotMessage = function(testPath, message) {
  var self = this;

  if (message.type === 'stdio') {
    ['stdout', 'stderr'].forEach(function(streamName) {
      if (self._streams[streamName] && message[streamName]) {
        message[streamName].pipe(self._streams[streamName]);
      }
    });
  }
};

module.exports = Pipe;
