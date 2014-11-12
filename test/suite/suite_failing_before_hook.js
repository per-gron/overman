'use strict';

before(function() {
  console.log('running_before_hook');
  throw new Error('fail');
});

it('should succeed', function() {
  console.log('running_test');
});

after(function() {
  console.log('running_after_hook');
});
