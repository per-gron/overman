'use strict';

describe('Suite', function() {
  before(function() {
    console.log('running_inner_before_hook');
  });

  it('should succeed', function() {
    console.log('running_test');
  });
});

before(function() {
  console.log('running_outer_before_hook');
});
