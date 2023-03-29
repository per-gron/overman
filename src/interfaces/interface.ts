import RuntimeContext from '../runtime_context';

export type Done = (err?: unknown) => void;

export type RunnerCallback = (done: Done) => void;
export type RunnerAsync<T> = () => PromiseLike<T> | void;

export type Runner<T = unknown> = RunnerCallback | RunnerAsync<T>;

interface EntryOptions {
  /**
   * When `skipped` is true, this test or suite will be skipped.
   */
  skipped?: boolean;
  /**
   * When `only` is true, only this test or suite and other tests and suites marked as only are run.
   */
  only?: boolean;
  /**
   * When `unstable` is true, this test or suite will be skipped if run with `runUnstable` option.
   */
  unstable?: boolean;
}

interface BaseEntry extends EntryOptions {
  attributes?: Record<string, unknown>;
}

export interface TestEntry extends BaseEntry {
  /**
   * Always 'test'.
   */
  type: 'test';
  /**
   * It is an error to have two tests in the same suite with the same name.
   */
  name: string;
  /**
   * Test is skipped if not provided.
   */
  run?: Runner;
}

export type Hook = { name?: string; run: Runner };

export type SuiteParameters = {
  /**
   * When present, all tests in this suite should be run with this as the timeout, rather than the
   * global timeout (unless it is overridden again in a subsuite or the test itself).
   */
  timeout?: number;
  /**
   * When present, all tests in this suite should be run with this as the slowness threshold, rather
   * than the global slowness threshold (unless it is overridden again in a subsuite or the test
   * itself).
   */
  slow?: number;
};

export type ChildEntry = SuiteEntry | TestEntry;

/**
 * Describes a test suite. Not serializable to JSON.
 */
export interface SuiteEntry extends BaseEntry, SuiteParameters {
  /**
   * Always 'suite'.
   */
  type: 'suite';
  /**
   * Not required in root SuiteEntry, but likely present in sub suites.
   */
  name?: string;
  /**
   * Array of sub suites and tests
   */
  contents: ChildEntry[];
  /**
   * Before-hooks.
   */
  before?: Hook[];
  /**
   * After-hooks.
   */
  after?: Hook[];
}

/**
 * Entry point for a test interface.
 *
 * @param param Parameter to the interface, as provided by the user.
 *     '' if not set. Many interfaces will not use this at
 *     all, but for some use cases it really comes in handy.
 * @param file Path to the suite file that should be parsed. May be absolute or
 *     relative to the cwd.
 * @param ctx The runtime context, for communication with the suite
 *     runner and reporters. This parameter is undefined when Overman is only
 *     listing tests and doesn't intend to actually run them. See below for more
 *     details.
 *
 * @return The root SuiteEntry.
 */
export interface TestInterface {
  <T>(this: unknown, param: string, file: string, ctx?: RuntimeContext<T>): SuiteEntry;
}

export { RuntimeContext };
