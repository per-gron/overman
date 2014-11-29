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
var expect = require('chai').expect;
var when = require('when');
var Combined = require('../lib/reporter/combined');

describe('Combined reporter', function() {
  ['registrationFailed', 'registerTests', 'gotMessage', 'done'].forEach(function(message) {
    describe(message, function() {
      it('should not forward ' + message + ' calls when it has no reporters', function() {
        (new Combined([]))[message]('a');
      });

      it('should forward ' + message + 'calls', function(done) {
        var reporter = {};
        reporter[message] = function() {
          expect(_.toArray(arguments)).to.be.deep.equal([1, 2, 3]);
          done();
        };

        (new Combined([reporter]))[message](1, 2, 3);
      });

      it('should not forward ' + message + 'calls when reporter doesn\'t implement it', function() {
        (new Combined([{}]))[message]();
      });

      it('should forward ' + message + 'calls to multiple reporters', function() {
        var reporter1 = {};
        var reporter1Promise = when.promise(function(resolve) {
          reporter1[message] = function() {
            expect(_.toArray(arguments)).to.be.deep.equal([1, 2, 3]);
            resolve();
          };
        });

        var reporter2 = {};
        var reporter2Promise = when.promise(function(resolve) {
          reporter2[message] = function() {
            expect(_.toArray(arguments)).to.be.deep.equal([1, 2, 3]);
            resolve();
          };
        });

        (new Combined([reporter1, reporter2]))[message](1, 2, 3);

        return when.all([reporter1Promise, reporter2Promise]);
      });
    });
  });
});
