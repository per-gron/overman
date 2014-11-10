'use strict';

var path = require('path');

function newSuite(skipped, only, name) {
  return {
    type: 'suite',
    name: name,
    skipped: skipped,
    only: only,
    contents: [],
    before: [],
    after: []
  };
}

module.exports = function(file) {
  var suite = newSuite();

  // Since we always run only one test per process, there is no difference between
  // a hook that runs before every test and a hook that runs before a test suite.
  global.before = global.beforeEach = function(fn) {
    suite.before.push(fn);
  };

  global.after = global.afterEach = function(fn) {
    suite.after.push(fn);
  };

  function describe(options, name, fn) {
    var subSuite = newSuite(options.skipped || !fn, options.only, name);
    var parentSuite = suite;
    suite = subSuite;
    fn();
    parentSuite.contents.push(subSuite);
    suite = parentSuite;
  }

  global.describe = describe.bind(this, { skipped: false, only: false });
  global.describe.skip = describe.bind(this, { skipped: true, only: false });
  global.describe.only = describe.bind(this, { skipped: false, only: true });

  function it(options, name, fn) {
    if (name in suite.contents) {
      throw new Error('Redefining test ' + name);
    }
    suite.contents.push({
      type: 'test',
      name: name,
      skipped: options.skipped || !fn,
      only: options.only,
      run: fn
    });
  }

  global.it = it.bind(this, { skipped: false, only: false });
  global.it.skip = it.bind(this, { skipped: true, only: false });
  global.it.only = it.bind(this, { skipped: false, only: true });

  require(path.resolve(file));

  return suite;
};
