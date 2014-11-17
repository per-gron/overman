'use strict';

var _ = require('lodash');
var path = require('path');

function setIfDefined(object, key, value) {
  if (typeof value !== 'undefined') {
    object[key] = value;
  }
}

function newSuite(skipped, only, name) {
  var suite = {
    type: 'suite',
    contents: []
  };

  setIfDefined(suite, 'only', only);
  setIfDefined(suite, 'skipped', skipped);
  setIfDefined(suite, 'name', name);

  return suite;
}

var moduleCache = {};

module.exports = function(file, runtimeContext) {
  var absoluteFile = path.resolve(file);

  if (absoluteFile in moduleCache) {
    return moduleCache[absoluteFile];
  }

  var suite = newSuite();

  function hookHandler(type) {
    return function() {
      var args = _.toArray(arguments);
      var name;
      var fn;
      if (typeof args[0] === 'string') {
        fn = args[1];
        name = args[0];
      } else {
        fn = args[0];
        name = fn.name ? fn.name : undefined;
      }

      if (!suite[type]) {
        suite[type] = [];
      }

      var hook = { run: fn };
      setIfDefined(hook, 'name', name);

      suite[type].push(hook);
    };
  }

  // Since we always run only one test per process, there is no difference between
  // a hook that runs before every test and a hook that runs before a test suite.
  global.before = global.beforeEach = hookHandler('before');
  global.after = global.afterEach = hookHandler('after');

  function describe(options, name, fn) {
    var subSuite = newSuite(fn ? options.skipped : true, options.only, name);
    var parentSuite = suite;
    suite = subSuite;
    if (fn) {
      fn();
    }
    parentSuite.contents.push(subSuite);
    suite = parentSuite;
  }

  global.describe = describe.bind(this, {});
  global.describe.skip = describe.bind(this, { skipped: true });
  global.describe.only = describe.bind(this, { only: true });

  function it(options, name, fn) {
    if (name in suite.contents) {
      throw new Error('Redefining test ' + name);
    }

    var test = {
      type: 'test',
      name: name
    };

    setIfDefined(test, 'skipped', fn ? options.skipped : true);
    setIfDefined(test, 'only', options.only);
    if (fn) {
      test.run = fn.bind({
        timeout: function(newTimeout) {
          if (_.isUndefined(newTimeout)) {
            return runtimeContext.getTimeout();
          } else {
            runtimeContext.setTimeout(newTimeout);
          }
        }
      });
    }

    suite.contents.push(test);
  }

  global.it = it.bind(this, {});
  global.it.skip = it.bind(this, { skipped: true });
  global.it.only = it.bind(this, { only: true });

  require(absoluteFile);

  moduleCache[absoluteFile] = suite;

  return suite;
};
