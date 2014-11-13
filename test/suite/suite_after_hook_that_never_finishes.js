'use strict';

var when = require('when');

after(function() {
  return when.promise(function() {});
});

it('should succeed', function() {});
