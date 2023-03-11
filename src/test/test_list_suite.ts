/*
 * Copyright 2014-2016 Per Eckerdal
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
import { ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as through from 'through';
import { listTestsOfFile, ListTestError, Options, ForkFn } from '../list_suite';
import shouldFail from './util/should_fail';

function list(suite: string, timeout?: number | unknown, options?: Options) {
  return listTestsOfFile(
    typeof timeout === 'number' ? timeout : 2000,
    `${__dirname}/../interfaces/bdd_mocha`,
    'param',
    suite,
    options
  );
}

describe('List suite', function () {
  describe('ListTestError', function () {
    it('should be instanceof Error', function () {
      expect(new ListTestError() instanceof Error).to.be.true;
    });

    it('should have a message with the suite name', function () {
      const error = new ListTestError('suite_name');
      expect(error).property('message').to.contain('suite_name');
    });

    it('should have a stack with the suite name', function () {
      const error = new ListTestError('suite_name');
      expect(error).property('stack').to.contain('suite_name');
    });

    it('should elide error output when not present', function () {
      const error = new ListTestError('suite_name');
      expect(error).property('stack').to.be.equal('suite_name');
    });

    it('should have a stack with the error output', function () {
      const error = new ListTestError('suite_name', 'error\noutput');
      expect(error).property('stack').to.contain('error\noutput');
    });
  });

  describe('#listTestsOfFile', function () {
    it('should parse stdout JSON on success', async function () {
      const suite = path.resolve(`${__dirname}/../../data/suite/suite_single_successful_test`);
      const result = await list(suite);
      expect(result).to.be.deep.equal([{ path: { file: suite, path: ['should succeed'] } }]);
    });

    it('should parse attributes', async function () {
      const suite = path.resolve(`${__dirname}/../../data/suite/suite_single_test_attributes`);
      const result = await list(suite);
      expect(result).to.be.deep.equal([
        { path: { file: suite, path: ['should succeed'] }, attributes: { foo: 'bar' } },
      ]);
    });

    it('should parse attributes where test attributes overrides the suite', async function () {
      const suite = path.resolve(`${__dirname}/../../data/suite/suite_attributes`);
      const result = await list(suite);
      expect(result).to.be.deep.equal([
        {
          path: { file: suite, path: ['suite', 'should override'] },
          attributes: { foo: 'baz', bar: 'qux' },
        },
        {
          path: { file: suite, path: ['suite', 'should override again'] },
          attributes: { foo: 'quux', bar: 'qux' },
        },
      ]);
    });

    it('should report skipped tests as skipped', async function () {
      const suite = path.resolve(`${__dirname}/../../data/suite/suite_single_skipped_test`);
      const result = await list(suite);
      expect(result).to.be.deep.equal([
        {
          path: { file: suite, path: ['should be skipped'] },
          skipped: true,
        },
      ]);
    });

    it('should report tests where the suite overrides the timeout', async function () {
      const suite = path.resolve(`${__dirname}/../../data/suite/suite_timeout_set_in_suite`);
      const result = await list(suite);
      expect(result).to.be.deep.equal([
        {
          path: { file: suite, path: ['A suite', 'should print its timeout'] },
          timeout: 1234,
        },
      ]);
    });

    it('should report tests where the suite overrides the slowness threshold', async function () {
      const suite = path.resolve(`${__dirname}/../../data/suite/suite_slow_set_in_suite`);
      const result = await list(suite);
      expect(result).to.be.deep.equal([
        {
          path: { file: suite, path: ['A suite', 'should print its slowness threshold'] },
          slow: 1234,
        },
      ]);
    });

    it('should report tests marked as only', async function () {
      const suite = path.resolve(`${__dirname}/../../data/suite/suite_single_only_test`);
      const result = await list(suite);
      expect(result).to.be.deep.equal([
        {
          path: { file: suite, path: ['should be run only'] },
          only: true,
        },
      ]);
    });

    it('should report unstable tests as unstable', async function () {
      const suite = path.resolve(`${__dirname}/../../data/suite/suite_single_unstable_test`);
      const result = await list(suite);
      expect(result).to.be.deep.equal([
        {
          path: { file: suite, path: ['should be run if unstable'] },
          unstable: true,
        },
      ]);
    });

    it('should fail with a ListTestError when the listing fails', function () {
      const suite = path.resolve(`${__dirname}/../../data/suite/suite_syntax_error`);
      return shouldFail(list(suite), function (error) {
        expect(error)
          .property('message')
          .to.match(/Failed to process .*suite_syntax_error/);
        expect(error)
          .property('stack')
          .to.match(/SyntaxError: Unexpected identifier/);
        return error instanceof ListTestError;
      });
    });

    it('should fail with a timed out ListTestError when the listing times out', function () {
      const suite = path.resolve(__dirname + '/../../data/suite/suite_neverending_listing');
      return shouldFail(list(suite, 10), function (error) {
        expect(error)
          .property('message')
          .to.match(/Timed out while listing tests of .*suite_neverending_listing/);
        expect(error)
          .property('stack')
          .to.match(/Timed out while listing tests of .*suite_neverending_listing/);
        expect(error).property('timeout').to.be.true;
        return error instanceof ListTestError;
      });
    });

    it('should kill the subprocess on timeout', async function () {
      let killed = false;

      const fork: ForkFn = () =>
        ({
          stdout: through(),
          stderr: through(),
          on() {
            return this;
          },
          kill(signal) {
            expect(signal).to.be.equal('SIGKILL');
            killed = true;
            return false;
          },
        } as Partial<ChildProcessWithoutNullStreams> as ChildProcessWithoutNullStreams);

      const suite = path.resolve(__dirname + '/../../data/suite/suite_neverending_listing');
      await shouldFail(list(suite, 10, { fork }), function (error) {
        return error instanceof ListTestError;
      });
      expect(killed).to.be.true;
    });

    it('should treat a 0 timeout as no timeout', function () {
      const suite = path.resolve(__dirname + '/../../data/suite/suite_single_successful_test');
      return list(suite, 0);
    });

    it('should provide the test interface parameter to the list_suite process', async function () {
      let paramChecked = false;

      const fork: ForkFn = (_, parameters) => {
        expect(parameters).to.have.nested.property('[1]', 'param');

        // Trick the listTestsOfFile function that the process closes
        paramChecked = true;
        const stdout = through();
        return {
          stdout,
          stderr: through(),
          on(event, fn) {
            expect(event).to.be.equal('exit');
            fn(0, null);
            stdout.end();
            return this;
          },
          kill() {
            return false;
          },
        } as Partial<ChildProcessWithoutNullStreams> as ChildProcessWithoutNullStreams;
      };

      await list('dummy_suite', 100, { fork });
      expect(paramChecked).to.be.true;
    });

    it('should provide the test interface parameter to the interface', async function () {
      const result = await listTestsOfFile(
        1000,
        `${__dirname}/../../data/util/dummy_parameterized_interface`,
        'test_param',
        'suite'
      );
      expect(result).to.be.deep.equal([{ path: { file: 'suite', path: ['test_param'] } }]);
    });
  });
});
