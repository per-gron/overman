'use strict';

it('should succeed', function() {
  throw new Error('test fail');
});

after('after hook', function() {
  throw new Error('after fail');
});
