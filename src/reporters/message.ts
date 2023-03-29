import { TestPath } from '../test_path';

/**
 * The test attributes. This message is emitted only for tests with declared or inherited attributes.
 */
export interface AttributesMessage {
  type: 'attributes';
  attributes: Record<string, unknown>;
}

/**
 * Emitted whenever the test emits a breadcrumb. The purpose of `breadcrumb`
 * messages is to ease debugging, in particular test failures that show up as
 * timeouts.
 *
 * Overman itself generates breadcrumbs for each main phase of the test: One for
 * every hook and one for the test. These breadcrumb messages are marked with
 * `systemGenerated` set to `true`.
 */
export interface BreadcrumbMessage {
  type: 'breadcrumb';
  message: string;
  trace?: string;
  systemGenerated?: boolean;
}

export interface SuiteMessage {
  type: 'suiteStart' | 'suiteFinish';
  suite: TestPath;
}

/**
 * The test will begin momentarily. This message is emitted exactly once per test,
 * and is always the first message for a given test run. `skipped` will be `true`
 * if the test is going to be skipped.
 */
export interface StartMessage {
  type: 'start';
  skipped?: boolean;
  unstable?: boolean;
}

/**
 * The test process has printed something to stdout/stderr.
 */
export interface IOMessage {
  type: 'stdout' | 'stderr';
  data: string;
}

/**
 * The test is now about to run the before hooks. This message is emitted even when
 * there are no before hooks. When the test is skipped this message is not emitted.
 */
export interface StartedBeforeHooksMessage {
  type: 'startedBeforeHooks';
}

/**
 * A before hook is now running. This message is emitted once per before hook. When
 * the test is skipped this message is not emitted.
 */
export interface StartedBeforeHookMessage {
  type: 'startedBeforeHook';
  name?: string;
}

/**
 * The before hooks have successfully completed, and the actual test has started.
 * This message is emitted at most once per test. It is not emitted for skipped
 * tests, when a before hook failed or when the test timed out before the before
 * hooks finished.
 */
export interface StartedTestMessage {
  type: 'startedTest';
}

/**
 * Emitted when the test has finished running (successfully or not) or after a
 * before hook has failed. It means that the test runner is about to execute the
 * after hooks. This message is emitted even when there are not after hooks. This
 * message is *not* emitted when the test timed out before this stage.
 */
export interface StartedAfterHooksMessage {
  type: 'startedAfterHooks';
}

export interface StartedAfterHookMessage {
  type: 'startedAfterHook';
  name?: string;
}

export interface FinishedAfterHooksMessage {
  type: 'finishedAfterHooks';
}

/**
 * When a test times out, this message is emitted. It is not necessary to listen to
 * this message in order to determine if a test timed out or not. When a test times
 * out there is always also a `finish` message with `result` `timeout`.
 */
export interface TimeoutMessage {
  type: 'timeout';
}

export interface CompletionMessage {
  code?: number;
  signal?: string;
}

/**
 * Emitted when the test has finished running. This message is emitted exactly once
 * per test, and is always the last message for a given test.
 *
 * The `result` field is the canonical result of the test. If `result` is
 * `"failure"`, the test counts as failed, even if no errors were emitted (this
 * does not normally happen, but it could in the case of a crash). A test should
 * only be considered successful if `result` is `"success"`. Skipped tests have
 * `result` `"skipped"`, test that time out have `"timeout"`. Tests that ran while
 * the suite runner was cancelled will be reported with a `result` of `"aborted"`.
 *
 * If the `result` is `"success"` or `"failure"`, the `code` and possibly the
 * `signal` fields will be present. `code` has the exit code of the test process,
 * `signal` has node's string representation of a signal that terminated the
 * process, for example `"SIGKILL"`.
 */
export interface FinishMessage extends CompletionMessage {
  type: 'finish';
  result: 'skipped' | 'failure' | 'success' | 'timeout' | 'aborted';
  unstable?: boolean;
}

export interface FinishMessageWithSlowness extends FinishMessage {
  duration?: number;
  halfSlow?: boolean;
  slow?: boolean;
}

/**
 * When Overman is configured to attempt to run a test more than once if it fails
 * at first, and the test fails, a `retry` message is emitted instead of a `finish`
 * message when the test fails and it will be attempted again. The format of
 * `retry` messages is identical to that of `finish` messages, except that the
 * result field of a `retry` message can never be `"success"`.
 *
 * No new `start` message is emitted after a `retry` message, it is implied that
 * the test has started. Other than that, the new test run will emit messages as if
 * it was the first one.
 */
export interface RetryMessage extends CompletionMessage {
  type: 'retry';
  result: 'failure' | 'timeout' | 'aborted';
  unstable?: boolean;
}

export interface BaseErrorMessage {
  type: 'error';
  stack: string;
}

export interface TestErrorMessage extends BaseErrorMessage {
  in: 'test' | 'uncaught';
}

export interface HookErrorMessage extends BaseErrorMessage {
  in: 'beforeHook' | 'afterHook';
  inName?: string;
}

/**
 * Whenever an error occurs in the test, an `error` message is emitted. Several
 * `error` messages can be emitted for each test run, for example if both the test
 * itself and an after hook fails.
 *
 * The `stack` field contains the bulk of the information about the error. It
 * typically is the `trace` property of the error object.
 *
 * The `in` field is always present and contains information about where the error
 * occured. If an uncaught exception is thrown, `in` is `"uncaught"`.
 *
 * If the error occurs in a named before or after hook, its name is in the `inName`
 * field.
 */
export type ErrorMessage = TestErrorMessage | HookErrorMessage;

export interface SetTimeoutMessage {
  type: 'setTimeout';
  value: number;
}

export interface SetSlowThresholdMessage {
  type: 'setSlowThreshold';
  value: number;
}

/**
 * Emitted whenever the test emits debug info. The purpose of `debugInfo` messages
 * is to add a channel for tests to feed free-form data to reporters, for example
 * metadata about latencies, user names, log files etc. Neither Overman itself nor
 * any of the built in reporters do anything with these messages except passing
 * them on.
 */
export interface DebugInfoMessage {
  type: 'debugInfo';
  name: string;
  value: unknown;
}

export interface SigintMessage {
  type: 'sigint';
}

export type Message<FinishMessageT extends FinishMessage = FinishMessage> =
  | AttributesMessage
  | BreadcrumbMessage
  | SuiteMessage
  | StartMessage
  | IOMessage
  | StartedBeforeHooksMessage
  | StartedBeforeHookMessage
  | StartedTestMessage
  | StartedAfterHooksMessage
  | StartedAfterHookMessage
  | FinishedAfterHooksMessage
  | TimeoutMessage
  | FinishMessageT
  | RetryMessage
  | ErrorMessage
  | TestErrorMessage
  | HookErrorMessage
  | SetTimeoutMessage
  | SetSlowThresholdMessage
  | DebugInfoMessage
  | SigintMessage;

export type MessageWithSlowness = Message<FinishMessageWithSlowness>;
