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

import * as childProcess from 'child_process';
import * as psTree from 'ps-tree';
import isRunning = require('is-running');
import { ChildProcess } from 'child_process';
import { expect } from 'chai';
import { waitForStreamToEmitLines } from './util/stream';
import { Message } from '../reporters/message';
import { ProcessLike } from '../process_like';

function runTestWithInterfacePath(suite: string, interfacePath: string, ...testPath: string[]) {
  const parameters = JSON.stringify({
    timeout: 1234,
    slowThreshold: 2345,
    interfaceParameter: 'interface_param',
    killSubProcesses: true,
    attributes: { attr: 'ibute' },
  });
  const args = [interfacePath, parameters, `${__dirname}/../../data/suite/${suite}`, ...testPath];
  return childProcess.fork(`${__dirname}/../bin/run_test`, args, {
    silent: true,
  }) as childProcess.ChildProcessWithoutNullStreams;
}

function runTest(suite: string, ...testPath: string[]) {
  return runTestWithInterfacePath(suite, `${__dirname}/../interfaces/bdd_mocha`, ...testPath);
}

function waitForProcessToExit(process: ChildProcess) {
  return new Promise<void>((resolve, reject) => {
    process.on('exit', (code, signal) => {
      if (!signal && code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code} (signal ${signal})`));
      }
    });
  });
}

function waitForProcessToFail(process: ProcessLike) {
  return new Promise<void>((resolve, reject) => {
    process.on('exit', (code, signal) => {
      if (!signal && code === 1) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code} (signal ${signal})`));
      }
    });
  });
}

describe('Test runner', function () {
  it('should run before hooks', function () {
    const process = runTest('suite_before_hook_and_test', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [/running_before_hook/, /running_test/]),
    ]);
  });

  it('should run after hooks', function () {
    const process = runTest('suite_after_hook_and_test', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [/running_test/, /running_after_hook/]),
    ]);
  });

  it('should run before hooks in the order they were specified', function () {
    const process = runTest('suite_before_hooks_and_test', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [/running_before_hook_1/, /running_before_hook_2/]),
    ]);
  });

  it('should run after hooks in the order they were specified', function () {
    const process = runTest('suite_after_hooks_and_test', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [/running_after_hook_1/, /running_after_hook_2/]),
    ]);
  });

  it('should run all after hooks, even if they fail', function () {
    const process = runTest('suite_failing_after_hooks_and_test', 'should succeed');
    return Promise.all([
      waitForProcessToFail(process),
      waitForStreamToEmitLines(process.stdout, [/running_after_hook_1/, /running_after_hook_2/]),
    ]);
  });

  it('should run ancestor suite before hooks before children suite before hooks', function () {
    const process = runTest('suite_before_hooks_in_subsuite', 'Suite', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
        /running_outer_before_hook/,
        /running_inner_before_hook/,
        /running_test/,
      ]),
    ]);
  });

  it('should run ancestor suite after hooks after childen suite after hooks', function () {
    const process = runTest('suite_after_hooks_in_subsuite', 'Suite', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /running_inner_after_hook/,
        /running_outer_after_hook/,
      ]),
    ]);
  });

  it('should not run test if before hook fails', function () {
    const process = runTest('suite_failing_before_hook', 'should succeed');
    return Promise.all([
      waitForProcessToFail(process),
      waitForStreamToEmitLines(process.stdout, [/running_before_hook/, /running_after_hook/]),
    ]);
  });

  it('should run after hooks even when test fails', function () {
    const process = runTest('suite_after_hook_and_failing_test', 'should fail');
    return Promise.all([
      waitForProcessToFail(process),
      waitForStreamToEmitLines(process.stdout, [/running_after_hook/]),
    ]);
  });

  it('should have title and full title in the test', function () {
    const process = runTest('suite_test_title', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [/should succeed/, /should succeed/]),
    ]);
  });

  it('should have title and full title in before each hook', function () {
    const process = runTest('suite_before_each_hook_title', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [/should succeed/, /should succeed/]),
    ]);
  });

  it('should have title and full title in after each hook', function () {
    const process = runTest('suite_after_each_hook_title', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [/should succeed/, /should succeed/]),
    ]);
  });

  it("should run tests that don't return a promise", function () {
    const process = runTest('suite_single_successful_test', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [/running_test/]),
    ]);
  });

  it('should run tests that return a promise asynchronously', function () {
    const process = runTest('suite_test_returning_promise', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /still_running_test/,
        /running_after_hook/,
      ]),
    ]);
  });

  it('should run tests that take a done callback', function () {
    const process = runTest('suite_test_invoking_done', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /still_running_test/,
        /running_after_hook/,
      ]),
    ]);
  });

  it('should run tests that take a done callback and invokes it synchronously', function () {
    const process = runTest('suite_test_invoking_done_synchronously', 'should succeed');
    return Promise.all([
      waitForProcessToExit(process),
      waitForStreamToEmitLines(process.stdout, [
        /running_test/,
        /still_running_test/,
        /running_after_hook/,
      ]),
    ]);
  });

  it('should fail tests invoke the done with an error', function () {
    const process = runTest('suite_test_invoking_done_with_error', 'should fail');
    return Promise.all([
      waitForProcessToFail(process),
      waitForStreamToEmitLines(process.stdout, [/running_test/, /failed_test/]),
    ]);
  });

  it('should not let tests call the done callback more than once', function () {
    const process = runTest('suite_test_that_completes_twice', 'should succeed twice');
    return Promise.all([
      waitForProcessToFail(process),
      new Promise<void>((resolve) => {
        process.on('message', (message: Message) => {
          if (
            message.type === 'error' &&
            /done callback invoked more than once/.test(message.stack)
          ) {
            resolve();
          }
        });
      }),
    ]);
  });

  it('should catch and propagate uncaught exceptions', function () {
    const process = runTest('suite_single_test_uncaught_exception', 'should throw uncaught error');
    return Promise.all([
      waitForProcessToFail(process),
      new Promise<void>((resolve) => {
        process.on('message', (message: Message) => {
          if (message.type === 'error' && /Uncaught/.test(message.stack)) {
            resolve();
          }
        });
      }),
    ]);
  });

  it('should catch and propagate uncaught strings', function () {
    const process = runTest(
      'suite_single_test_uncaught_non_exception',
      'should throw uncaught error'
    );
    return Promise.all([
      waitForProcessToFail(process),
      new Promise<void>((resolve) => {
        process.on('message', (message: Message) => {
          if (message.type === 'error' && /Uncaught/.test(message.stack)) {
            resolve();
          }
        });
      }),
    ]);
  });

  it('should catch and propagate uncaught nulls', function () {
    const process = runTest('suite_single_test_uncaught_null', 'should throw uncaught error');
    return Promise.all([
      waitForProcessToFail(process),
      new Promise<void>((resolve) => {
        process.on('message', (message: Message) => {
          if (message.type === 'error' && /Unknown error/.test(message.stack)) {
            resolve();
          }
        });
      }),
    ]);
  });

  it('should mark tests that throw an exception as failing', function () {
    const process = runTest('suite_single_throwing_test', 'should throw');
    return waitForProcessToFail(process);
  });

  it('should mark tests that return a failed promise as failing', function () {
    const process = runTest('suite_single_failing_test', 'should fail');
    return waitForProcessToFail(process);
  });

  it('should exit if the test is done but there are still things on the runloop', function () {
    const process = runTest('suite_with_nonempty_runloop', 'should succeed');
    return waitForProcessToExit(process);
  });

  describe('Attributes', function () {
    it('should have attributes set on context and on this', function () {
      const process = runTest('suite_single_test_attributes', 'should succeed');
      return new Promise<void>((resolve) => {
        process.on('message', (message: { type: string }) => {
          if (message.type === 'in_test_attributes') {
            const expectedAttributes = { attr: 'ibute' };
            expect(message).property('contextAttributes').to.be.deep.equal(expectedAttributes);
            expect(message).property('testAttributes').to.be.deep.equal(expectedAttributes);
            process.kill();
            resolve();
          }
        });
      });
    });
  });

  describe('Timeout handling', function () {
    it("should exit when receiving a 'sigint' message", function () {
      const process = runTest('suite_single_test_that_never_finishes', 'should never finish');
      process.send({ type: 'sigint' });
      return waitForProcessToFail(process);
    });

    it("should invoke after hooks when receiving a 'sigint' message", function () {
      const process = runTest(
        'suite_single_test_that_never_finishes_with_after_hook',
        'should never finish'
      );
      process.send({ type: 'sigint' });
      return Promise.all([
        waitForProcessToFail(process),
        waitForStreamToEmitLines(process.stdout, [/in_after_hook/]),
      ]);
    });

    it("should invoke after hooks only once even when tests finish after the 'sigint' message was received", function () {
      const process = runTest('suite_ensure_after_hook_is_only_run_once', 'should be run');
      process.send({ type: 'sigint' });
      return Promise.all([
        waitForProcessToFail(process),
        waitForStreamToEmitLines(process.stdout, [/in_test/, /in_after_hook/]),
      ]);
    });
  });

  describe('Getting and setting timeouts', function () {
    it('should pass test timeout to the interface', function () {
      const process = runTest('suite_timeout_print', 'should print its timeout');
      return Promise.all([
        waitForProcessToExit(process),
        waitForStreamToEmitLines(process.stdout, [/1234/]),
      ]);
    });

    it('should emit setTimeout messages when the test asks to change the timeout', function () {
      const process = runTest('suite_timeout_set', 'should set the timeout');
      return new Promise<void>((resolve) => {
        process.on('message', (message: { type: string }) => {
          if (message.type === 'setTimeout') {
            expect(message).property('value').to.be.equal(10);
            process.kill();
            resolve();
          }
        });
      });
    });
  });

  describe('Slow thresholds', function () {
    it('should pass slow threshold to the interface', function () {
      const process = runTest('suite_slow_print', 'should print its slow threshold');
      return Promise.all([
        waitForProcessToExit(process),
        waitForStreamToEmitLines(process.stdout, [/2345/]),
      ]);
    });

    it('should emit setSlowThreshold messages when the test asks to change the slow threshold', function () {
      const process = runTest('suite_slow_set', 'should set the slow threshold');
      return new Promise<void>((resolve) => {
        process.on('message', (message: { type: string }) => {
          if (message.type === 'setSlowThreshold') {
            expect(message).property('value').to.be.equal(20);
            process.kill();
            resolve();
          }
        });
      });
    });
  });

  describe('Breadcrumbs', function () {
    it('should emit breadcrumb messages when the test leaves a breadcrumb', function () {
      const process = runTest('suite_leave_breadcrumb', 'should leave breadcrumb');
      return new Promise<void>((resolve) => {
        process.on('message', (message: Message) => {
          if (message.type === 'breadcrumb' && message.message === 'A breadcrumb') {
            expect(message).property('trace').to.be.contain('suite_leave_breadcrumb.js:');
            process.kill();
            resolve();
          }
        });
      });
    });
  });

  describe('Debug info', function () {
    it('should emit debugInfo messages info when the test emits debug info', function () {
      const process = runTest('suite_emit_debug_info', 'should emit debug info');
      return new Promise<void>((resolve) => {
        process.on('message', (message: Message) => {
          if (message.type === 'debugInfo') {
            expect(message).property('name').to.be.equal('name');
            expect(message).property('value').to.be.deep.equal({ the: 'value' });
            process.kill();
            resolve();
          }
        });
      });
    });
  });

  describe('Interface parameter', function () {
    it('should propagate the interface parameter', function () {
      const process = runTestWithInterfacePath(
        'suite_single_successful_test',
        `${__dirname}/../../data/util/dummy_parameterized_interface`,
        'interface_param'
      );

      return Promise.all([
        waitForProcessToExit(process),
        waitForStreamToEmitLines(process.stdout, [/param: "interface_param"/]),
      ]);
    });
  });

  describe('Subprocess lifetime', function () {
    type WindowsPS = psTree.PS & { COMM: string };

    it('should kill spawned subprocesses on exit', async function () {
      const process = runTest(
        'suite_single_test_that_spawns_never_ending_processes.js',
        'should spawn child processes'
      );
      expect(process.pid).to.be.exist;
      const childrenPID = await new Promise<number[]>((resolve, reject) => {
        process.on('message', (message: { state: string }) => {
          if (message.state === 'forked') {
            psTree(process.pid!, (_, children) => {
              const childrenPID = children
                .filter((p) => {
                  // command key is different on linux/windows
                  const command = p.COMMAND ? p.COMMAND : (p as WindowsPS).COMM;
                  return command.includes('node');
                })
                .map((p) => Number.parseInt(p.PID, 10));
              process.send({ state: 'killme' });
              childrenPID.length === 2
                ? resolve(childrenPID)
                : reject(`Incorrect amount of processes running, was: ${childrenPID}`);
            });
          }
        });
      });
      await waitForProcessToExit(process);
      await new Promise<void>((resolve, reject) => {
        // Timeout for making sure the processes have been killed, could cause
        // instability and might need to be changed
        setTimeout(() => {
          const result = [
            { pid: childrenPID[0], alive: isRunning(childrenPID[0]) },
            { pid: childrenPID[1], alive: isRunning(childrenPID[1]) },
          ];
          !result[0].alive && !result[1].alive
            ? resolve()
            : reject('A child was still alive: ' + JSON.stringify(result));
        }, 500);
      });
    });

    it('should kill spawned subprocesses on timeout', async function () {
      const process = runTest(
        'suite_single_test_that_never_finishes_and_spawns_never_ending_processes.js',
        'should spawn child processes and never finish'
      );
      expect(process.pid).to.be.exist;
      const childrenPID = await new Promise<number[]>((resolve, reject) => {
        process.on('message', (message: { state: string }) => {
          if (message.state === 'forked') {
            // There could be instability here, since the process could potentially be killed
            // before listing children.
            psTree(process.pid!, (_, children) => {
              const childrenPID = children
                .filter((p) => {
                  // command key is different on linux/windows
                  const command = p.COMMAND ? p.COMMAND : (p as WindowsPS).COMM;
                  return command.includes('node');
                })
                .map((p) => Number.parseInt(p.PID, 10));
              process.send({ state: 'killme' });
              childrenPID.length === 2
                ? resolve(childrenPID)
                : reject(`Incorrect amount of processes running, was: ${childrenPID}`);
            });
          }
        });
      });
      process.send({ type: 'sigint' });
      await waitForProcessToFail(process);
      await new Promise<void>((resolve, reject) => {
        // Timeout for making sure the processes have been killed, could cause
        // instability and might need to be increased
        setTimeout(() => {
          const result = [
            { pid: childrenPID[0], alive: isRunning(childrenPID[0]) },
            { pid: childrenPID[1], alive: isRunning(childrenPID[1]) },
          ];
          !result[0].alive && !result[1].alive
            ? resolve()
            : reject('A child was still alive: ' + JSON.stringify(result));
        }, 500);
      });
    });
  });
});
