'use strict';

it('should succeed', function(done) {
  console.log('running_test');
  process.nextTick(function() {
    // The idea here is that if the test runner respects that we take the
    // done callback, then this should be run before the after hook.
    console.log('still_running_test');
    done();
  });
});

after(function() {
  console.log('running_after_hook');
});
