import {
  Context as _Context,
  SuiteContext as _SuiteContext,
  Done as _Done,
  Func as _Func,
  AsyncFunc as _AsyncFunc,
  HookFunction as _HookFunction,
  ExclusiveSuiteFunction as _ExclusiveSuiteFunction,
  PendingSuiteFunction as _PendingSuiteFunction,
  UnstableSuiteFunction as _UnstableSuiteFunction,
  SuiteFunction as _SuiteFunction,
  ExclusiveTestFunction as _ExclusiveTestFunction,
  PendingTestFunction as _PendingTestFunction,
  UnstableTestFunction as _UnstableTestFunction,
  TestFunction as _TestFunction,
} from './bdd_mocha_context';

declare global {
  namespace Overman {
    type Context<T> = _Context<T>;
    type SuiteContext<T> = _SuiteContext<T>;
    type Done = _Done;
    type Func<T> = _Func<T>;
    type AsyncFunc<T> = _AsyncFunc<T>;
    type HookFunction<T> = _HookFunction<T>;

    type ExclusiveSuiteFunction<T> = _ExclusiveSuiteFunction<T>;
    type PendingSuiteFunction<T> = _PendingSuiteFunction<T>;
    type UnstableSuiteFunction<T> = _UnstableSuiteFunction<T>;
    type SuiteFunction<T> = _SuiteFunction<T>;

    type ExclusiveTestFunction<T> = _ExclusiveTestFunction<T>;
    type PendingTestFunction<T> = _PendingTestFunction<T>;
    type UnstableTestFunction<T> = _UnstableTestFunction<T>;
    type TestFunction<T> = _TestFunction<T>;
  }

  /**
   * Execute before running tests.
   *
   * - _Only available when invoked via Overman._
   */
  var before: Overman.HookFunction<unknown>;

  /**
   * Execute after running tests.
   *
   * - _Only available when invoked via Overman._
   */
  var after: Overman.HookFunction<unknown>;

  /**
   * Execute before each test case.
   *
   * - _Only available when invoked via Overman._
   */
  var beforeEach: Overman.HookFunction<unknown>;

  /**
   * Execute after each test case.
   *
   * - _Only available when invoked via Overman._
   */
  var afterEach: Overman.HookFunction<unknown>;

  /**
   * Describe a "suite" containing nested suites and tests.
   *
   * - _Only available when invoked via Overman._
   */
  var describe: Overman.SuiteFunction<unknown>;

  /**
   * The currently runnning test context.
   *
   * - _Only available when invoked via Overman._
   */
  var context: Overman.Context<unknown>;

  /**
   * Describes a test case.
   *
   * - _Only available when invoked via Overman._
   */
  var it: Overman.TestFunction<unknown>;
}
