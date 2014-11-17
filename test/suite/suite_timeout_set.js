'use strict';

var when = require('when');

it('should set the timeout', function() {
  this.timeout(10);
  return when.promise(function() {});  // Never complete the test
});
