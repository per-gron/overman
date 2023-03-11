import { TestPath } from '../test_path';
import { Message } from './message';

export interface RegisterOptions {
  timeout: number;
  listingTimeout: number;
  slowThreshold: number;
  graceTime: number;
  attempts: number;
}

/**
 * Instantiated in the suite runner process (doesn't share memory with tests).
 * An uncaught exception will cause the entire test run to fail.
 *
 * The minimal valid Reporter instance is `{}`
 */
export default interface Reporter<T extends Message = Message> {
  /**
   * The first thing that Overman does is to evaluate the test files to extract the list of tests to
   * be run.
   *
   * Note that the suite runner may be aborted while it's working (for example by the user pressing
   * Ctrl-C) and in such cases the test run will end early and the reporter may not receive messages
   * for remaining tests.
   *
   * @param tests Array of all tests that the suite runner intends to report results for (including
   * tests that will be skipped)
   */
  registerTests?(tests: TestPath[], options: RegisterOptions, time: Date): void;
  /**
   * If registration fails, for example because there is a syntax error or the test attempts to
   * require a nonexistent module, this method is called.
   * @param error An Error object with information about what went wrong.
   */
  registrationFailed?(error: Error, time: Date): void;
  /**
   * Called zero or more times, always after registerTests and before done.
   * See {Message} class.
   *
   * The messages from a given test will always be sent in sequence. Tests may
   * however be run in parallel. When they are, messages for different tests will
   * be interleaved. For example, when executing two tests A and B, each test
   * emitting A1, A2, A3, B1, B2 and B3, respectively, the messages may be emitted
   * in any of these ways (and lots of other ways):
   *
   * * A1, A2, A3, B1, B2, B3
   * * B1, B2, A1, A2, B3, A3
   * * B1, A1, B2, A2, B3, A3
   *
   * For some reporters this is not a problem at all (for example reporters that
   * simply detect errors and do something with the errors at the end). Other
   * reporters need this information in order to get to know test results as soon
   * as possible (for example the spec reporter).
   *
   * For some reporters, the interleaved nature of test messages make things very
   * tricky (for example the TeamCity reporter that emits test results to a flat
   * stream). For this use case, there is a helper reporter Serializer that will
   * delay certain messages so that test messages and suites are not interleaved.
   *
   */
  gotMessage?(testPath: TestPath, message: T, time: Date): void;
  /**
   * This method is invoked exactly once and is always the last method to be
   * called. (The exception is when registrationFailed is invoked; then this
   * method will not be called.) Here it is appropriate to do things like
   * emitting a test result summary.
   *
   * Please note that it is not possible to induce when tests have finished
   * running by looking at the tests passed to registerTests and waiting for all
   * tests to finish, because if the test run is aborted (for example by the user
   * pressing Ctrl-C on the suite runner), not all tests will be run.
   */
  done?(time: Date): void;
}
