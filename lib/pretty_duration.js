'use strict';

module.exports = function(time) {
  var s = Math.round(time / 1000) % 60;
  var m = Math.round(time / 1000 / 60) % 60;
  var h = Math.round(time / 1000 / 60 / 60);

  var times = [
    h && h + 'h',
    m && m + 'm',
    s && s + 's'
  ].filter(function(x) { return x; });

  return times.join(' ') || '0s';
};
