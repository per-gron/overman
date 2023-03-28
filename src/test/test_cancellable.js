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

var expect = require('chai').expect;
var Cancellable = require('../reporters/cancellable');

describe('Cancellable reporter', function () {
  describe('Forwarding', function () {
    ['registrationFailed', 'registerTests', 'done', 'gotMessage'].forEach(function (message) {
      it('should forward ' + message + ' calls', function (done) {
        var reporter = {};
        reporter[message] = function (arg1, arg2) {
          expect(arg1).to.be.equal('arg1');
          expect(arg2).to.be.equal('arg2');
          done();
        };

        var cancellable = new Cancellable(reporter);
        cancellable[message]('arg1', 'arg2');
      });

      it('should not forward ' + message + ' calls after being cancelled', function () {
        var reporter = {};
        var cancellable = new Cancellable(reporter);
        cancellable.cancel();

        reporter[message] = function () {
          throw new Error(message + ' was called even though the reporter was cancelled');
        };

        cancellable[message]('arg1', 'arg2');
      });
    });
  });

  describe('Finished', function () {
    it('should not be finished from the start', function () {
      var cancellable = new Cancellable({});
      expect(cancellable.isFinished()).to.be.false;
    });

    it('should be finished after registrationFailed', function () {
      var cancellable = new Cancellable({});
      cancellable.registrationFailed(new Error('Fail'));
      expect(cancellable.isFinished()).to.be.true;
    });

    it('should not be finished after registerTests', function () {
      var cancellable = new Cancellable({});
      cancellable.registerTests([]);
      expect(cancellable.isFinished()).to.be.false;
    });

    it('should not be finished after gotMessage', function () {
      var cancellable = new Cancellable({});
      cancellable.gotMessage({}, {});
      expect(cancellable.isFinished()).to.be.false;
    });

    it('should be finished after done', function () {
      var cancellable = new Cancellable({});
      cancellable.done();
      expect(cancellable.isFinished()).to.be.true;
    });

    it('should be finished after cancel', function () {
      var cancellable = new Cancellable({});
      cancellable.cancel();
      expect(cancellable.isFinished()).to.be.true;
    });
  });

  describe('Cancellation', function () {
    it('should report outstanding tests as aborted when cancelled', function (done) {
      var finishedTests = [];
      var cancellable = new Cancellable({
        done: function () {
          done(
            finishedTests.length === 1 ? undefined : new Error('Invalid number of finish messages')
          );
        },
        gotMessage: function (testPath, message) {
          if (message.type === 'finish') {
            finishedTests.push(testPath);
          }
        },
      });
      cancellable.registerTests(['test1', 'test2']);
      cancellable.gotMessage('test1', { type: 'start' });
      cancellable.cancel();
      cancellable.done();
    });

    it('should report only outstanding tests as aborted when cancelled', function (done) {
      var finishedTests = [];
      var cancellable = new Cancellable({
        done: function () {
          done(
            finishedTests.length === 2 ? undefined : new Error('Invalid number of finish messages')
          );
        },
        gotMessage: function (testPath, message) {
          if (message.type === 'finish') {
            finishedTests.push(testPath);
          }
        },
      });
      cancellable.registerTests(['test1', 'test2']);
      cancellable.gotMessage('test1', { type: 'start' });
      cancellable.gotMessage('test2', { type: 'start' });
      cancellable.gotMessage('test1', { type: 'finish' });
      cancellable.cancel();
      cancellable.done();
    });

    it('should not invoke done unless registerTests has been called', function () {
      var cancellable = new Cancellable({
        done: function () {
          throw new Error('should not be called');
        },
      });
      cancellable.cancel();
    });
  });
});
