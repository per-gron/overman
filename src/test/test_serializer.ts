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

import { expect } from 'chai';
import { Message } from '../reporters/message';
import { RegisterOptions } from '../reporters/reporter';
import Serializer from '../reporters/serializer';
import { TestPath } from '../test_path';

const REG_OPTS: RegisterOptions = {
  timeout: 0,
  listingTimeout: 0,
  slowThreshold: 0,
  graceTime: 0,
  attempts: 0,
};
const DATE = new Date(42);

function getTestPathsFromMessages(messages: [TestPath, Message][]) {
  return [...new Map(messages.map(([path]) => [JSON.stringify(path), path])).values()];
}

/**
 * Takes a bunch of test messages and passes them through the serializer.
 * Returns an array the messages that the serializer emitted.
 *
 * For example, the following input:
 *
 * [
 *   [{ file: 'file', path: ['test1'] }, { type: 'start' }],
 *   [{ file: 'file', path: ['test2'] }, { type: 'start' }],
 *   [{ file: 'file', path: ['test1'] }, { type: 'finish', result: 'success' }],
 *   [{ file: 'file', path: ['test2'] }, { type: 'finish', result: 'success' }]
 * ]
 *
 * should return
 *
 * [
 *   [{ file: 'file', path: ['test1'] }, { type: 'start' }],
 *   [{ file: 'file', path: ['test1'] }, { type: 'finish', result: 'success' }],
 *   [{ file: 'file', path: ['test2'] }, { type: 'start' }],
 *   [{ file: 'file', path: ['test2'] }, { type: 'finish', result: 'success' }]
 * ]
 */
function processMessages(
  messages: [TestPath, Message][],
  options: { testPaths?: TestPath[]; dontSendDone?: boolean } = {}
) {
  const output: [TestPath, Message][] = [];

  const serializer = new Serializer({
    registerTests: function () {},
    gotMessage: function (testPath, message) {
      output.push([testPath, message]);
    },
    done: function () {},
  });

  serializer.registerTests(options.testPaths ?? getTestPathsFromMessages(messages), REG_OPTS, DATE);
  messages.forEach(function (message) {
    serializer.gotMessage(message[0], message[1], DATE);
  });
  if (!options.dontSendDone) {
    serializer.done(DATE);
  }

  return output;
}

describe('Serializer reporter', function () {
  it('should forward registerTests calls', function (done) {
    const serializer = new Serializer({
      registerTests: function (testPaths) {
        expect(testPaths).to.be.deep.equal([]);
        done();
      },
    });

    serializer.registerTests([], REG_OPTS, DATE);
  });

  it('should forward registrationFailed calls', function (done) {
    const serializer = new Serializer({
      registrationFailed: function (error) {
        expect(error).property('message').to.be.equal('hello');
        done();
      },
    });

    serializer.registrationFailed(new Error('hello'), DATE);
  });

  it("should handle reporters that don't implement registerTests", function () {
    const serializer = new Serializer({});
    serializer.registerTests([], REG_OPTS, DATE);
  });

  it("should handle reporters that don't implement gotMessage", function () {
    const theTestPath = { file: 'file', path: ['test'] };
    const serializer = new Serializer({});

    serializer.registerTests([theTestPath], REG_OPTS, DATE);
    serializer.gotMessage(theTestPath, { type: 'start', unstable: false }, DATE);
    serializer.gotMessage(
      theTestPath,
      { type: 'finish', result: 'success', unstable: false },
      DATE
    );
    serializer.done(DATE);
  });

  it('should forward done calls', function (done) {
    const serializer = new Serializer({
      registerTests: function () {},
      done: () => done(),
    });

    serializer.registerTests([], REG_OPTS, DATE);
    serializer.done(DATE);
  });

  it('should immediately forward the first message it gets', function () {
    const theTestPath = { file: 'file', path: ['test'] };

    expect(
      processMessages([[theTestPath, { type: 'start' }]], { dontSendDone: true })
    ).to.be.deep.equal([[theTestPath, { type: 'start' }]]);
  });

  it('should emit messages for two parallel tests as if they were run sequentially', function () {
    const test1Path = { file: 'file', path: ['test1'] };
    const test2Path = { file: 'file', path: ['test2'] };

    expect(
      processMessages([
        [test1Path, { type: 'start' }],
        [test2Path, { type: 'start' }],
        [test1Path, { type: 'finish', result: 'success' }],
        [test2Path, { type: 'finish', result: 'success' }],
      ])
    ).to.be.deep.equal([
      [test1Path, { type: 'start' }],
      [test1Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
    ]);
  });

  it('should complain when getting mismatched starts', function () {
    expect(function () {
      processMessages([[{ file: 'file', path: ['test'] }, { type: 'start' }]]);
    }).to.throw(Error);
  });

  it('should complain when getting mismatched pending starts', function () {
    expect(function () {
      processMessages([
        [{ file: 'file', path: ['test'] }, { type: 'start' }],
        [{ file: 'file', path: ['test2'] }, { type: 'start' }],
      ]);
    }).to.throw(Error);
  });

  it('should complain when getting messages from tests that have finished', function () {
    expect(function () {
      processMessages([
        [{ file: 'file', path: ['test'] }, { type: 'start' }],
        [
          { file: 'file', path: ['test'] },
          { type: 'finish', result: 'success' },
        ],
        [{ file: 'file', path: ['test'] }, { type: 'start' }],
      ]);
    }).to.throw(
      'Got message (type start) for test that has already finished: {"file":"file","path":["test"]}'
    );
  });

  it('should handle done calls when there are outstanding tests', function () {
    // When the suite runner is cancelled (for example by the user pressing
    // Ctrl-C), not all tests will be run. Serializer needs to handle this.
    // Note that, even when the suite runner is cancelled, all the tests that
    // have been reported to start will also get a finish message.

    const test1Path = { file: 'file', path: ['suite1', 'test1'] };
    const test2Path = { file: 'file', path: ['suite2', 'test2'] };
    const test3Path = { file: 'file', path: ['suite3', 'test3'] };

    expect(
      processMessages(
        [
          [test1Path, { type: 'start' }],
          [test2Path, { type: 'start' }],
          [test1Path, { type: 'finish', result: 'success' }],
          [test2Path, { type: 'finish', result: 'success' }],
        ],
        { testPaths: [test1Path, test2Path, test3Path] }
      )
    ).to.be.deep.equal([
      [test1Path, { type: 'start' }],
      [test1Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
    ]);
  });

  it('should emit start message for a test as soon as it can', function () {
    const test1Path = { file: 'file', path: ['test1'] };
    const test2Path = { file: 'file', path: ['test2'] };
    const test3Path = { file: 'file', path: ['test3'] };

    expect(
      processMessages(
        [
          [test1Path, { type: 'start' }],
          [test2Path, { type: 'start' }],
          [test3Path, { type: 'start' }],
          [test1Path, { type: 'finish', result: 'success' }],
        ],
        { dontSendDone: true }
      )
    ).to.be.deep.equal([
      [test1Path, { type: 'start' }],
      [test1Path, { type: 'finish', result: 'success' }],
      // Here, the second test should be chosen to begin, even though it doens't know
      // if the second or the third test will actually finish first. The reason this
      // behavior is desirable is that it makes it possible for a sequential run to
      // emit messages continuously, as if it wasn't being serialized at all.
      //
      // This will make it possible for reporters to show output of a test as it runs,
      // and not just after it finishes.
      [test2Path, { type: 'start' }],
    ]);
  });

  it('should emit multiple finished tests if it can', function () {
    const test1Path = { file: 'file', path: ['test1'] };
    const test2Path = { file: 'file', path: ['test2'] };
    const test3Path = { file: 'file', path: ['test3'] };

    expect(
      processMessages(
        [
          [test1Path, { type: 'start' }],
          [test2Path, { type: 'start' }],
          [test2Path, { type: 'finish', result: 'success' }],
          [test3Path, { type: 'start' }],
          [test3Path, { type: 'finish', result: 'success' }],
          [test1Path, { type: 'finish', result: 'success' }],
        ],
        { dontSendDone: true }
      )
    ).to.be.deep.equal([
      [test1Path, { type: 'start' }],
      [test1Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
      [test3Path, { type: 'start' }],
      [test3Path, { type: 'finish', result: 'success' }],
    ]);
  });

  it('should emit messages for finished tests as soon as possible', function () {
    const test1Path = { file: 'file', path: ['test1'] };
    const test2Path = { file: 'file', path: ['test2'] };
    const test3Path = { file: 'file', path: ['test3'] };

    expect(
      processMessages([
        [test1Path, { type: 'start' }],
        [test2Path, { type: 'start' }],
        [test3Path, { type: 'start' }],
        [test3Path, { type: 'finish', result: 'success' }],
        [test1Path, { type: 'finish', result: 'success' }],
        [test2Path, { type: 'finish', result: 'success' }],
      ])
    ).to.be.deep.equal([
      [test1Path, { type: 'start' }],
      [test1Path, { type: 'finish', result: 'success' }],
      [test3Path, { type: 'start' }],
      [test3Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
    ]);
  });

  it('should not serialize tests from within a test file', function () {
    // Only suites are serialized, and files don't count as suites
    const test11Path = { file: 'file1', path: ['test1'] };
    const test12Path = { file: 'file1', path: ['test2'] };
    const test2Path = { file: 'file2', path: ['test3'] };

    expect(
      processMessages([
        [test11Path, { type: 'start' }],
        [test11Path, { type: 'finish', result: 'success' }],
        [test2Path, { type: 'start' }],
        [test2Path, { type: 'finish', result: 'success' }],
        [test12Path, { type: 'start' }],
        [test12Path, { type: 'finish', result: 'success' }],
      ])
    ).to.be.deep.equal([
      [test11Path, { type: 'start' }],
      [test11Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
      [test12Path, { type: 'start' }],
      [test12Path, { type: 'finish', result: 'success' }],
    ]);
  });

  it('should not pick a test from another suite unless the current suite is done', function () {
    const test11Path = { file: 'file', path: ['suite', 'test1'] };
    const test12Path = { file: 'file', path: ['suite', 'test2'] };
    const test2Path = { file: 'file', path: ['test3'] };

    expect(
      processMessages(
        [
          [test11Path, { type: 'start' }],
          [test11Path, { type: 'finish', result: 'success' }],
          [test2Path, { type: 'start' }],
          [test12Path, { type: 'start' }],
        ],
        { dontSendDone: true }
      )
    ).to.be.deep.equal([
      [test11Path, { type: 'start' }],
      [test11Path, { type: 'finish', result: 'success' }],
      [test12Path, { type: 'start' }],
    ]);
  });

  it('should suppress messages from a different suite until the current one is done', function () {
    const test11Path = { file: 'file', path: ['suite', 'test1'] };
    const test12Path = { file: 'file', path: ['suite', 'test2'] };
    const test2Path = { file: 'file', path: ['test3'] };

    expect(
      processMessages([
        [test11Path, { type: 'start' }],
        [test2Path, { type: 'start' }],
        [test2Path, { type: 'finish', result: 'success' }],
        [test12Path, { type: 'start' }],
        [test11Path, { type: 'finish', result: 'success' }],
        [test12Path, { type: 'finish', result: 'success' }],
      ])
    ).to.be.deep.equal([
      [test11Path, { type: 'start' }],
      [test11Path, { type: 'finish', result: 'success' }],
      [test12Path, { type: 'start' }],
      [test12Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
    ]);
  });

  it('should suppress messages from a suite until all tests in a subsuite is done', function () {
    const test11Path = { file: 'file', path: ['suite', 'subsuite', 'test1'] };
    const test12Path = { file: 'file', path: ['suite', 'subsuite', 'test2'] };
    const test2Path = { file: 'file', path: ['suite', 'test3'] };

    expect(
      processMessages([
        [test11Path, { type: 'start' }],
        [test2Path, { type: 'start' }],
        [test2Path, { type: 'finish', result: 'success' }],
        [test12Path, { type: 'start' }],
        [test11Path, { type: 'finish', result: 'success' }],
        [test12Path, { type: 'finish', result: 'success' }],
      ])
    ).to.be.deep.equal([
      [test11Path, { type: 'start' }],
      [test11Path, { type: 'finish', result: 'success' }],
      [test12Path, { type: 'start' }],
      [test12Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
    ]);
  });

  it('should move from one suite to another', function () {
    const test1Path = { file: 'file', path: ['suite1', 'test'] };
    const test2Path = { file: 'file', path: ['suite2', 'test'] };

    const messages: [TestPath, Message][] = [
      [test1Path, { type: 'start' }],
      [test1Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
    ];
    expect(processMessages(messages)).to.be.deep.equal(messages);
  });

  it('should move from one suite to another, with overlap', function () {
    const test1Path = { file: 'file', path: ['suite1', 'test'] };
    const test2Path = { file: 'file', path: ['suite2', 'test'] };

    expect(
      processMessages([
        [test1Path, { type: 'start' }],
        [test2Path, { type: 'start' }],
        [test1Path, { type: 'finish', result: 'success' }],
        [test2Path, { type: 'finish', result: 'success' }],
      ])
    ).to.be.deep.equal([
      [test1Path, { type: 'start' }],
      [test1Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
    ]);
  });

  it('should move from one suite to another, after overlap', function () {
    const test1Path = { file: 'file', path: ['suite1', 'test1'] };
    const test2Path = { file: 'file', path: ['suite1', 'test2'] };
    const test3Path = { file: 'file', path: ['suite2', 'test3'] };

    expect(
      processMessages([
        [test1Path, { type: 'start' }],
        [test2Path, { type: 'start' }],
        [test2Path, { type: 'finish', result: 'success' }],
        [test1Path, { type: 'finish', result: 'success' }],
        [test3Path, { type: 'start' }],
        [test3Path, { type: 'finish', result: 'success' }],
      ])
    ).to.be.deep.equal([
      [test1Path, { type: 'start' }],
      [test1Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
      [test3Path, { type: 'start' }],
      [test3Path, { type: 'finish', result: 'success' }],
    ]);
  });

  it('should allow tests in subsuites to run while there are pending tests in that suite', function () {
    const test11Path = { file: 'file', path: ['suite', 'test1'] };
    const test12Path = { file: 'file', path: ['suite', 'subsuite', 'test2'] };
    const test2Path = { file: 'file', path: ['suite', 'test3'] };

    expect(
      processMessages([
        [test11Path, { type: 'start' }],
        [test12Path, { type: 'start' }],
        [test11Path, { type: 'finish', result: 'success' }],
        [test2Path, { type: 'start' }],
        [test2Path, { type: 'finish', result: 'success' }],
        [test12Path, { type: 'finish', result: 'success' }],
      ])
    ).to.be.deep.equal([
      [test11Path, { type: 'start' }],
      [test11Path, { type: 'finish', result: 'success' }],
      [test12Path, { type: 'start' }],
      [test12Path, { type: 'finish', result: 'success' }],
      [test2Path, { type: 'start' }],
      [test2Path, { type: 'finish', result: 'success' }],
    ]);
  });
});
