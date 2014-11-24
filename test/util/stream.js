'use strict';

var readline = require('readline');
var when = require('when');

function waitForStreamToEmitLines(stream, linesToWatchFor) {
  return when.promise(function(resolve, reject) {
    var lines = readline.createInterface({ input: stream, output: stream });

    lines.on('line', function(line) {
      if (linesToWatchFor.length === 0) {
        reject(new Error('Encountered unexpected line ' + line + ' when expecting no more output'));
      }

      var regex = linesToWatchFor[0];
      if (typeof regex === 'string' ? line === regex : line.match(regex)) {
        linesToWatchFor.shift();
      } else {
        reject(new Error('Encountered unexpected line ' + line + ', expected ' + linesToWatchFor[0]));
        lines.close();
      }
    });

    lines.on('close', function() {
      if (linesToWatchFor.length === 0) {
        resolve();
      } else {
        reject(new Error('Encountered end of output while still waiting for ' + linesToWatchFor));
      }
    });
  });
}
exports.waitForStreamToEmitLines = waitForStreamToEmitLines;
