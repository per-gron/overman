/*
 * Copyright 2016 Per Eckerdal
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
const { setTimeout } = require('timers/promises');
var promiseUtil = require('../promise_util');

describe('Promise utilities', function () {
  describe('finally', function () {
    it('should support returning value when promise succeeds', async function () {
      let callbackHit = false;
      const value = await promiseUtil.finally(Promise.resolve(123), function () {
        callbackHit = true;
      });
      expect(callbackHit).to.be.true;
      expect(value).to.equal(123);
    });

    it('should support returning value when promise fails', async function () {
      let callbackHit = false;
      await promiseUtil
        .finally(Promise.reject(123), function () {
          callbackHit = true;
        })
        .then(
          function () {
            throw new Error('should fail');
          },
          function (err) {
            expect(err).to.equal(123);
          }
        );

      expect(callbackHit).to.be.true;
    });

    [true, false].forEach(function (succeed) {
      it(
        'should support returning promise when promise ' + (succeed ? 'succeeds' : 'fails'),
        function () {
          var initialPromise = succeed ? Promise.resolve(123) : Promise.reject(123);
          var mainPromise = promiseUtil
            .finally(initialPromise, function () {
              return new Promise(function () {}); // Never fulfilled
            })
            .then(function () {
              throw new Error('should not reach this point');
            });

          return Promise.race([
            mainPromise, // Should not ever fulfill
            setTimeout(100),
          ]);
        }
      );
    });
  });
});
