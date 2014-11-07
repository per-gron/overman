it('should be awesome', function() {
});

describe('Something', function() {
  before(function beforeHook() {
    console.log('before');
  });

  it('should work', function() {});
  it('should really work', function() {});

  describe('#great', function() {
    it('should do its thing', function() {
      console.log('do the thing');
    });

    after(function afterHook() {
      console.log('after');
    });
  });
});
