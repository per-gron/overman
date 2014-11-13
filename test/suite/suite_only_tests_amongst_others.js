'use strict';

it('should not be run', function() {
  console.log('should_not_be_run');
});

it.only('should be run', function() {
  console.log('should_be_run');
});

it.only('should also be run', function() {
  console.log('should_also_be_run');
});

it('should not be run either', function() {
  console.log('should_not_be_run_either');
});
