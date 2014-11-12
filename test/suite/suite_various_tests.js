'use strict';

var when = require('when');

it('should be awesome', function() {
});

describe('Something', function() {
  before(function beforeHook() {
  });

  it('should work', function() {});
  it('should really work', function() {});

  describe('#great', function() {
    it('should do its thing', function() {
    });

    it('should fail', function() {
      throw new Error('No!');
    });

    it('should never finish', function() {
      return when.promise(function() {});
    });

    after(function afterHook() {
    });
  });
});
