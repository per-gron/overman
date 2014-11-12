'use strict';

after(function() {
  console.log('running_after_hook');
});

it('should fail', function() {
  throw new Error('Failing');
});
