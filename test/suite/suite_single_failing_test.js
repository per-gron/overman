'use strict';

var when = require('when');

it('should fail', function() {
  return when.reject(new Error('Failing test'));
});
