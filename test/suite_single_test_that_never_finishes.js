'use strict';

var when = require('when');

it('should never finish', function() {
  return when.promise(function() {});
});
