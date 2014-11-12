'use strict';

after(function() {
  console.log('running_after_hook_1');
});

after(function() {
  console.log('running_after_hook_2');
});

it('should succeed', function() {
});
