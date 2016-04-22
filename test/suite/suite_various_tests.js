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

it('should be awesome', function() {
});

describe('Something', function() {
  before(function beforeHook() {
  });

  it('should work', function() {
    console.log('should_work');
  });

  it('should really work', function() {
    console.log('should_really_work');
  });

  describe('#great', function() {
    it('should do its thing', function() {
    });

    it('should fail', function() {
      throw new Error('No!');
    });

    it('should never finish', function() {
      return new Promise(function() {});
    });

    after(function afterHook() {
    });
  });
});
