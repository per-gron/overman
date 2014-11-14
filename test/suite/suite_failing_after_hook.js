'use strict';

it('should succeed', function() {
  console.log('running_test');
});

after('after hook', function() {
  throw new Error('fail');
});
