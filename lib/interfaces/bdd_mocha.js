/*
 * Copyright 2014 Per Eckerdal
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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

function skipFirstNLines(string, n) {
  return string.split(/\n/).splice(n).join('\n');
}

var moduleCache = {};


function Context(runtimeContext) {
  this._runtimeContext = runtimeContext;
  this.currentTest = this;
}

Context.prototype.timeout = function(newTimeout) {
  if (_.isUndefined(newTimeout)) {
    return this._runtimeContext.getTimeout();
  } else {
    this._runtimeContext.setTimeout(newTimeout);
  }
};

Context.prototype.slow = function(newSlowThreshold) {
  if (_.isUndefined(newSlowThreshold)) {
    return this._runtimeContext.getSlowThreshold();
  } else {
    this._runtimeContext.setSlowThreshold(newSlowThreshold);
  }
};

Context.prototype.breadcrumb = function(messageOrError) {
  var message, trace;
  if (messageOrError instanceof Error) {
    message = messageOrError.message;
    trace = skipFirstNLines(messageOrError.stack, 1);
  } else {
    message = messageOrError;
    trace = skipFirstNLines((new Error()).stack, 2);
  }
  this._runtimeContext.leaveBreadcrumb(message, trace);
};

Context.prototype.debugInfo = function(name, value) {
  this._runtimeContext.emitDebugInfo(name, value);
};


module.exports = function(parameter, file, runtimeContext) {
  var absoluteFile = path.resolve(file);

  if (absoluteFile in moduleCache) {
    return moduleCache[absoluteFile];
  }

  var context = new Context(runtimeContext);
  global.context = context;

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

      if (!_.isFunction(fn)) {
        throw new Error('Got invalid hook function ' + fn);
      }
      fn = fn.bind(context);

      if (!suite[type]) {
        suite[type] = [];
      }

      var hook = { run: fn };
      setIfDefined(hook, 'name', name);

      suite[type].push(hook);
    };
  }

  function testForDuplicate(type, name) {
    if (_.find(suite.contents, function(test) { return test.name === name; })) {
      throw new Error('Redefining ' + type + ' "' + name + '"');
    }
  }

  // Since we always run only one test per process, there is no difference between
  // a hook that runs before every test and a hook that runs before a test suite.
  global.before = global.beforeEach = hookHandler('before');
  global.after = global.afterEach = hookHandler('after');

  function describe(options, name, fn) {
    testForDuplicate('suite', name);

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
    testForDuplicate('test', name);

    var test = {
      type: 'test',
      name: name
    };

    setIfDefined(test, 'skipped', fn ? options.skipped : true);
    setIfDefined(test, 'only', options.only);
    if (fn) {
      test.run = fn.bind(context);
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
