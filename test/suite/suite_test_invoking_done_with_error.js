'use strict';

it('should fail', function(done) {
  console.log('running_test');
  done(new Error('fail'));
  console.log('failed_test');
});
