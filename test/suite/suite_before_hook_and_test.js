'use strict';

before(function() {
  console.log('running_before_hook');
});

it('should succeed', function() {
  console.log('running_test');
});
