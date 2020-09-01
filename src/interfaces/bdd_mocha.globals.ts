/**
 * BDD Mocha interface
 */
declare namespace Overman {
  // #region Test interface augmentations

  interface HookFunction<T> {
    /**
     * [bdd, qunit, tdd] Describe a "hook" to execute the given callback `fn`. The name of the
     * function is used as the name of the hook.
     *
     * - _Only available when invoked via Overman._
     */
    (fn: Func<T>): void;

    /**
     * [bdd, qunit, tdd] Describe a "hook" to execute the given callback `fn`. The name of the
     * function is used as the name of the hook.
     *
     * - _Only available when invoked via Overman._
     */
    (fn: AsyncFunc<T>): void;

    /**
     * [bdd, qunit, tdd] Describe a "hook" to execute the given `title` and callback `fn`.
     *
     * - _Only available when invoked via Overman._
     */
    (name: string, fn?: Func<T>): void;

    /**
     * [bdd, qunit, tdd] Describe a "hook" to execute the given `title` and callback `fn`.
     *
     * - _Only available when invoked via Overman._
     */
    (name: string, fn?: AsyncFunc<T>): void;
  }

  interface BaseSuiteFunction<T> {
    /**
     * [bdd, tdd] Describe a "suite" with the given `title` and callback `fn` containing
     * nested suites.
     *
     * - _Only available when invoked via Overman._
     */
    (title: string, fn: (this: SuiteContext<T>) => void): void;

    /**
     * [qunit] Describe a "suite" with the given `title`.
     *
     * - _Only available when invoked via Overman._
     */
    (title: string): void;

    /**
     * Describe a specification or test-case with the given `title`, `attributes` and callback
     * `fn` acting as a thunk.
     *
     * - _Only available when invoked via Overman._
     */
    <U>(title: string, attributes: U, fn: (this: SuiteContext<T extends null | undefined ? U : T & U>) => void): void;

    /**
     * Describe a specification or test-case with the given `title`, `attributes` and callback
     * `fn` acting as a thunk.
     *
     * - _Only available when invoked via Overman._
     */
    <U>(title: string, attributes: U): void;
  }

  interface SuiteFunction<T> extends BaseSuiteFunction<T> {
    /**
     * [bdd, tdd, qunit] Indicates this suite should be executed exclusively.
     *
     * - _Only available when invoked via Overman._
     */
    only: ExclusiveSuiteFunction<T>;

    /**
     * [bdd, tdd] Indicates this suite should not be executed.
     *
     * - _Only available when invoked via Overman._
     */
    skip: PendingSuiteFunction<T>;

    /**
     * [bdd, tdd] Indicates this suite is unstable.
     *
     * - _Only available when invoked via Overman._
     */
    unstable: PendingSuiteFunction<T>;
  }

  interface ExclusiveSuiteFunction<T> extends BaseSuiteFunction<T> { }

  interface PendingSuiteFunction<T> extends BaseSuiteFunction<T> { }

  interface UnstableSuiteFunction<T> extends BaseSuiteFunction<T> { }

  interface BaseTestFunction<T> {
    /**
     * Describe a specification or test-case with the given callback `fn` acting as a thunk.
     * The name of the function is used as the name of the test.
     *
     * - _Only available when invoked via Overman._
     */
    (fn: Func<T>): void;

    /**
     * Describe a specification or test-case with the given callback `fn` acting as a thunk.
     * The name of the function is used as the name of the test.
     *
     * - _Only available when invoked via Overman._
     */
    (fn: AsyncFunc<T>): void;

    /**
     * Describe a specification or test-case with the given `title` and callback `fn` acting
     * as a thunk.
     *
     * - _Only available when invoked via Overman._
     */
    (title: string, fn?: Func<T>): void;

    /**
     * Describe a specification or test-case with the given `title` and callback `fn` acting
     * as a thunk.
     *
     * - _Only available when invoked via Overman._
     */
    (title: string, fn?: AsyncFunc<T>): void;

    /**
     * Describe a specification or test-case with the given `title`, `attributes` and callback
     * `fn` acting as a thunk.
     *
     * - _Only available when invoked via Overman._
     */
    <U>(title: string, attributes: U, fn?: Func<T extends null | undefined ? U : T & U>): void;

    /**
     * Describe a specification or test-case with the given `title`, `attributes` and callback
     * `fn` acting as a thunk.
     *
     * - _Only available when invoked via Overman._
     */
    <U>(title: string, attributes: U, fn?: AsyncFunc<T extends null | undefined ? U : T & U>): void;
  }

  interface TestFunction<T> extends BaseTestFunction<T> {
    /**
     * Indicates this test should be executed exclusively.
     *
     * - _Only available when invoked via Overman._
     */
    only: ExclusiveTestFunction<T>;

    /**
     * Indicates this test should not be executed.
     *
     * - _Only available when invoked via Overman._
     */
    skip: PendingTestFunction<T>;

    /**
     * Indicates this test is unstable.
     *
     * - _Only available when invoked via Overman._
     */
    unstable: UnstableTestFunction<T>;

    /**
     * Number of attempts to retry.
     *
     * - _Only available when invoked via Overman._
     */
    retries(n: number): void;
  }

  interface ExclusiveTestFunction<T> extends BaseTestFunction<T> { }

  interface PendingTestFunction<T> extends BaseTestFunction<T> { }

  interface UnstableTestFunction<T> extends BaseTestFunction<T> { }

  /**
   * Execute after each test case.
   *
   * - _Only available when invoked via Overman._
   */
  let afterEach: HookFunction<undefined>;

  /**
   * Execute after running tests.
   *
   * - _Only available when invoked via Overman._
   */
  let after: HookFunction<undefined>;

  /**
   * Execute before each test case.
   *
   * - _Only available when invoked via Overman._
   */
  let beforeEach: HookFunction<undefined>;

  /**
   * Execute before running tests.
   *
   * - _Only available when invoked via Overman._
   */
  let before: HookFunction<undefined>;

  /**
   * Describe a "suite" containing nested suites and tests.
   *
   * - _Only available when invoked via Overman._
   */
  let describe: SuiteFunction<undefined>;

  /**
   * Describes a test case.
   *
   * - _Only available when invoked via Overman._
   */
  let it: TestFunction<undefined>;

  // #endregion Test interface augmentations

  /**
   * Suite context
   */
  class SuiteContext<T> {
    attributes: T;

    /**
     * Get timeout & slow.
     */
    getParameters(): { timeout: number, slow: number };

    /**
     * Get test timeout.
     */
    timeout(): number;

    /**
     * Set test timeout.
     */
    timeout(ms: string | number): void;

    /**
     * Get test slowness threshold.
     */
    slow(): number;

    /**
     * Set test slowness threshold.
     */
    slow(ms: string | number): void;

    /**
     * Describe a nested "suite".
     *
     * - _Only available when invoked via Overman._
     */
    describe: SuiteFunction<T>;

    /**
     * Describes a nested test case.
     *
     * - _Only available when invoked via Overman._
     */
    it: TestFunction<T>;
  }

  /**
   * Test context
   */
  class Context<T> {
    title: string;
    currentTest?: Context<T>;
    attributes: T;

    fullTitle(): string;

    /**
     * Get test timeout.
     */
    timeout(): number;

    /**
     * Set test timeout.
     */
    timeout(ms: string | number): void;

    /**
     * Get test slowness threshold.
     */
    slow(): number;

    /**
     * Set test slowness threshold.
     */
    slow(ms: string | number): void;

    /**
     * Leave a breadcrumb to be printed in error for any failing assertions.
     */
    breadcrumb(messageOrError: string | Error): void;

    /**
     * Emit debug information.
     */
    debugInfo<U>(name: string, value: U): void;
  }

  type Done = (err?: any) => void;

  /**
   * Callback function used for tests and hooks with a context with typed `attributes`.
   */
  type Func<Attributes> = (this: Context<Attributes>, done: Done) => void;

  /**
   * Async callback function used for tests and hooks with a context with typed `attributes`.
   */
  type AsyncFunc<Attributes> = (this: Context<Attributes>) => PromiseLike<any>;

  /**
   * Variables added to the global scope by Overman when run in the CLI.
   */
  interface OvermanGlobals {
    /**
     * Execute before running tests.
     *
     * - _Only available when invoked via Overman._
     */
    before: HookFunction<undefined>;

    /**
     * Execute after running tests.
     *
     * - _Only available when invoked via Overman._
     */
    after: HookFunction<undefined>;

    /**
     * Execute before each test case.
     *
     * - _Only available when invoked via Overman._
     */
    beforeEach: HookFunction<undefined>;

    /**
     * Execute after each test case.
     *
     * - _Only available when invoked via Overman._
     */
    afterEach: HookFunction<undefined>;

    /**
     * Describe a "suite" containing nested suites and tests.
     *
     * - _Only available when invoked via Overman._
     */
    describe: SuiteFunction<undefined>;

    /**
     * Describe a "suite" containing nested suites and tests.
     *
     * - _Only available when invoked via Overman._
     */
    context: SuiteFunction<undefined>;

    /**
     * Describes a test case.
     *
     * - _Only available when invoked via Overman._
     */
    it: TestFunction<undefined>;
  }
}

// #region Test interface augmentations

/**
 * Execute before running tests.
 *
 * - _Only available when invoked via Overman._
 */
declare var before: Overman.HookFunction<undefined>;

/**
 * Execute after running tests.
 *
 * - _Only available when invoked via Overman._
 */
declare var after: Overman.HookFunction<undefined>;

/**
 * Execute before each test case.
 *
 * - _Only available when invoked via Overman._
 */
declare var beforeEach: Overman.HookFunction<undefined>;

/**
 * Execute after each test case.
 *
 * - _Only available when invoked via Overman._
 */
declare var afterEach: Overman.HookFunction<undefined>;

/**
 * Describe a "suite" containing nested suites and tests.
 *
 * - _Only available when invoked via Overman._
 */
declare var describe: Overman.SuiteFunction<undefined>;

/**
 * Describe a "suite" containing nested suites and tests.
 *
 * - _Only available when invoked via Overman._
 */
declare var context: Overman.SuiteFunction<undefined>;

/**
 * Describes a test case.
 *
 * - _Only available when invoked via Overman._
 */
declare var it: Overman.TestFunction<undefined>;

// #endregion Test interface augmentations

// #region Global augmentations

declare namespace NodeJS {
  // Augments NodeJS's `global` object when node.d.ts is loaded
  // tslint:disable-next-line no-empty-interface
  interface Global extends Overman.OvermanGlobals { }
}

// #endregion Global augmentations

declare module "overman" {
    export = Overman;
}
