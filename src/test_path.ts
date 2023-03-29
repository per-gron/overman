export interface TestPath {
  /**
   * Path to the test file, can be absolute or relative to the cwd.
   */
  file: string;
  /**
   * Array with at least one element (in the top level of a test file).
   * ["suite", "subsuite", "testname"]
   */
  path: string[];
}
