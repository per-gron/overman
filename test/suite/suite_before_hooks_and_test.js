'use strict';

before(function() {
  console.log('running_before_hook_1');
});

before(function() {
  console.log('running_before_hook_2');
});

it('should succeed', function() {
});
