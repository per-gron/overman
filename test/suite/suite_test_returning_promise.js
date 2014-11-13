'use strict';

var when = require('when');

it('should succeed', function() {
  return when.promise(function(resolve) {
    console.log('running_test');
    process.nextTick(function() {
      // The idea here is that if the test runner respects that we return a
      // promise here, then this should be run before the after hook.
      console.log('still_running_test');
      resolve();
    });
  });
});

after(function() {
  console.log('running_after_hook');
});
