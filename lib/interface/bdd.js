'use strict';

var path = require('path');

function newSuite(skipped, name) {
  return {
    type: 'suite',
    name: name,
    skipped: skipped,
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

  function describe(skipped, name, fn) {
    var subSuite = newSuite(skipped, name);
    var parentSuite = suite;
    suite = subSuite;
    fn();
    parentSuite.contents.push(subSuite);
    suite = parentSuite;
  }

  global.describe = describe.bind(this, false);
  global.describe.skip = describe.bind(this, true);

  function it(skipped, name, fn) {
    if (name in suite.contents) {
      throw new Error('Redefining test ' + name);
    }
    suite.contents.push({
      type: 'test',
      name: name,
      skipped: skipped || !fn,
      run: fn
    });
  }

  global.it = it.bind(this, false);
  global.it.skip = it.bind(this, true);

  require(path.resolve(file));

  return suite;
};
