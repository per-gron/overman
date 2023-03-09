import RuntimeContext from '../runtime_context';
import { Done } from './interface';

/**
 * Passed to TestFunction callback for async test cases to signal they're done.
 */
export { Done };

/**
 * Callback function used for tests and hooks with a context with typed `attributes`.
 */
export type Func<T> = (this: Context<T>, done: Done) => void;

/**
 * Async callback function used for tests and hooks with a context with typed `attributes`.
 */
export type AsyncFunc<T> = (this: Context<T>) => PromiseLike<unknown>;

export interface HookFunction<T> {
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
  <U extends Record<string, unknown>>(
    title: string,
    attributes: U,
    fn: (this: SuiteContext<T & U>) => void
  ): void;

  /**
   * Describe a specification or test-case with the given `title`, `attributes` and callback
   * `fn` acting as a thunk.
   *
   * - _Only available when invoked via Overman._
   */
  <U extends Record<string, unknown>>(title: string, attributes: U): void;
}

export interface ExclusiveSuiteFunction<T> extends BaseSuiteFunction<T> {}
export interface PendingSuiteFunction<T> extends BaseSuiteFunction<T> {}
export interface UnstableSuiteFunction<T> extends BaseSuiteFunction<T> {}

export interface SuiteFunction<T> extends BaseSuiteFunction<T> {
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

interface BaseTestFunction<T> {
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
  <U extends Record<string, unknown>>(title: string, attributes: U, fn?: Func<T & U>): void;

  /**
   * Describe a specification or test-case with the given `title`, `attributes` and callback
   * `fn` acting as a thunk.
   *
   * - _Only available when invoked via Overman._
   */
  <U extends Record<string, unknown>>(title: string, attributes: U, fn?: AsyncFunc<T & U>): void;
}

export interface ExclusiveTestFunction<T> extends BaseTestFunction<T> {}
export interface PendingTestFunction<T> extends BaseTestFunction<T> {}
export interface UnstableTestFunction<T> extends BaseTestFunction<T> {}

export interface TestFunction<T> extends BaseTestFunction<T> {
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
}

/**
 *
 */
export type SuiteParameters = { timeout?: number; slow?: number };

/**
 * Suite context
 */
export interface SuiteContext<T> {
  attributes: T;

  /**
   * Get timeout & slow.
   */
  getParameters(): SuiteParameters;

  /**
   * Get test timeout.
   */
  timeout(): number | null;

  /**
   * Set test timeout.
   */
  timeout(ms: number): void;

  /**
   * Get test slowness threshold.
   */
  slow(): number | null;

  /**
   * Set test slowness threshold.
   */
  slow(ms: number): void;

  /**
   * Execute before running tests.
   *
   * - _Only available when invoked via Overman._
   */
  before: HookFunction<T>;

  /**
   * Execute after running tests.
   *
   * - _Only available when invoked via Overman._
   */
  after: HookFunction<T>;

  /**
   * Execute before each test case.
   *
   * - _Only available when invoked via Overman._
   */
  beforeEach: HookFunction<T>;

  /**
   * Execute after each test case.
   *
   * - _Only available when invoked via Overman._
   */
  afterEach: HookFunction<T>;

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

export class SuiteContextImpl<T> implements SuiteContext<T> {
  private _parameters: SuiteParameters = {};

  public before = global.before;
  public after = global.after;
  public beforeEach = global.beforeEach;
  public afterEach = global.afterEach;
  public describe = global.describe;
  public it = global.it;

  constructor(
    private _parentContext: SuiteContextImpl<unknown> | undefined,
    public readonly attributes: T
  ) {}

  getParameters() {
    return this._parameters;
  }

  timeout(timeout: number): undefined;
  timeout(): number | null;
  timeout(timeout?: number) {
    if (timeout === undefined) {
      return this._parameters.timeout ?? this._parentContext?.timeout() ?? null;
    }
    this._parameters.timeout = Number(timeout);
  }

  slow(slow: number): undefined;
  slow(): number | null;
  slow(slow?: number) {
    if (slow === undefined) {
      return this._parameters.slow ?? this._parentContext?.slow() ?? null;
    }
    this._parameters.slow = Number(slow);
  }
}

function skipFirstNLines(string: string, n: number) {
  return string.split(/\n/).splice(n).join('\n');
}

/**
 * Test context
 */
export class Context<T> {
  title: string;
  currentTest: Context<T>;

  constructor(private runtimeContext?: RuntimeContext<T>) {
    this.currentTest = this;
    this.title = runtimeContext?.getTitle().at(-1) ?? '';
  }

  get attributes(): T {
    if (!this.runtimeContext) {
      throw new Error('Unexpected RuntimeContext access');
    }
    return this.runtimeContext.attributes;
  }

  fullTitle(): string {
    return this.runtimeContext?.getTitle().join(':') ?? '';
  }

  /**
   * Get test timeout.
   */
  timeout(): number;

  /**
   * Set test timeout.
   */
  timeout(ms: number): void;
  timeout(ms?: number) {
    if (ms === undefined) {
      return this.runtimeContext?.getTimeout();
    }
    this.runtimeContext?.setTimeout(ms);
  }

  /**
   * Get test slowness threshold.
   */
  slow(): number;

  /**
   * Set test slowness threshold.
   */
  slow(ms: number): void;
  slow(ms?: number) {
    if (ms === undefined) {
      return this.runtimeContext?.getSlowThreshold();
    }
    this.runtimeContext?.setSlowThreshold(ms);
  }

  /**
   * Leave a breadcrumb to be printed in error for any failing assertions.
   */
  breadcrumb(messageOrError: string | Error) {
    let message: string, trace: string;
    if (messageOrError instanceof Error) {
      message = messageOrError.message;
      trace = skipFirstNLines(messageOrError.stack ?? '', 1);
    } else {
      message = messageOrError;
      trace = skipFirstNLines(new Error().stack ?? '', 2);
    }
    this.runtimeContext?.leaveBreadcrumb(message, trace);
  }

  /**
   * Emit debug information.
   */
  debugInfo<U>(name: string, value: U) {
    this.runtimeContext?.emitDebugInfo(name, value);
  }
}
