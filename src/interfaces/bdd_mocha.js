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

function newSuite(skipped, only, unstable, name) {
  var suite = {
    type: 'suite',
    contents: []
  };

  setIfDefined(suite, 'only', only);
  setIfDefined(suite, 'skipped', skipped);
  setIfDefined(suite, 'unstable', unstable);
  setIfDefined(suite, 'name', name);

  return suite;
}

function skipFirstNLines(string, n) {
  return string.split(/\n/).splice(n).join('\n');
}

var moduleCache = {};


function SuiteContext(parentContext) {
  this._parentContext = parentContext;
  this._parameters = {};
}

SuiteContext.prototype.getParameters = function() {
  return this._parameters;
};

['timeout', 'slow'].forEach(function(parameter) {
  SuiteContext.prototype[parameter] = function(newValue) {
    if (_.isUndefined(newValue)) {
      if (parameter in this._parameters) {
        return this._parameters[parameter];
      } else if (this._parentContext) {
        return this._parentContext[parameter]();
      } else {
        return null;
      }
    } else {
      this._parameters[parameter] = newValue;
    }
  };
});


function Context(runtimeContext) {
  this._runtimeContext = runtimeContext;
  this.currentTest = this;
  this.currentTest.title = (runtimeContext && runtimeContext.getTitle)? runtimeContext.getTitle().slice(-1)[0]: '';
  this.fullTitle = function() { return (runtimeContext && runtimeContext.getTitle)? runtimeContext.getTitle().join(':'): ''; };
  this.attributes = (runtimeContext && runtimeContext.attributes);
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

  var suiteContext = new SuiteContext();
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

  function describe(options, name, attributes, fn) {
    testForDuplicate('suite', name);

    if (typeof attributes !== 'object') {
      fn = attributes;
      attributes = undefined;
    }
    var subSuite = newSuite(fn ? options.skipped : true, options.only, options.unstable, name);
    var parentSuite = suite;
    var parentContext = suiteContext;
    suite = subSuite;
    suiteContext = new SuiteContext(suiteContext);
    if (parentSuite.attributes || attributes) {
      attributes = _.assign({}, parentSuite.attributes, attributes);
      suiteContext.attributes = attributes;
      suite.attributes = attributes;
    }
    if (fn) {
      fn.apply(suiteContext);
    }
    parentSuite.contents.push(_.assign({}, suiteContext.getParameters(), subSuite));
    suiteContext = parentContext;
    suite = parentSuite;
  }

  global.describe = describe.bind(this, {});
  global.describe.skip = describe.bind(this, { skipped: true });
  global.describe.only = describe.bind(this, { only: true });
  global.describe.unstable = describe.bind(this, { unstable: true });

  function it(options, name, attributes, fn) {
    testForDuplicate('test', name);

    if (typeof attributes !== 'object') {
      fn = attributes;
      attributes = undefined;
    }
    var test = {
      type: 'test',
      name: name
    };

    setIfDefined(test, 'skipped', fn ? options.skipped : true);
    setIfDefined(test, 'only', options.only);
    setIfDefined(test, 'unstable', options.unstable);
    if (suite.attributes || attributes) {
      test.attributes = _.assign({}, suite.attributes, attributes);
    }
    if (fn) {
      test.run = fn.bind(context);
    }

    suite.contents.push(test);
  }

  global.it = it.bind(this, {});
  global.it.skip = it.bind(this, { skipped: true });
  global.it.only = it.bind(this, { only: true });
  global.it.unstable = it.bind(this, { unstable: true });

  require(absoluteFile);

  moduleCache[absoluteFile] = suite;

  return suite;
};
