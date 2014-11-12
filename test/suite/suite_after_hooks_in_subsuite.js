'use strict';

describe('Suite', function() {
  after(function() {
    console.log('running_inner_after_hook');
  });

  it('should succeed', function() {
    console.log('running_test');
  });
});

after(function() {
  console.log('running_outer_after_hook');
});
