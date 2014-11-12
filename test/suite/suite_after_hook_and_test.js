'use strict';

after(function() {
  console.log('running_after_hook');
});

it('should succeed', function() {
  console.log('running_test');
});
