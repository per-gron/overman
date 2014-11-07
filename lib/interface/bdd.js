'use strict';

var path = require('path');

function newSuite(name) {
  return {
    type: 'suite',
    name: name,
    contents: [],
    before: [],
    after: []
  };
}

module.exports = function(file) {
  var suite = newSuite();

  global.beforeEach = function(fn) {
    suite.before.push(fn);
  };

  global.afterEach = function(fn) {
    suite.after.push(fn);
  };

  global.describe = function(name, fn) {
    var subSuite = newSuite(name);
    var parentSuite = suite;
    suite = subSuite;
    fn();
    parentSuite.contents.push(subSuite);
    suite = parentSuite;
  };

  global.it = function(name, fn) {
    if (name in suite.contents) {
      throw new Error('Redefining test ' + name);
    }
    suite.contents.push({
      type: 'test',
      name: name,
      run: fn
    });
  };

  require(path.resolve(file));

  return suite;
};
