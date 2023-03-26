export default interface RuntimeContext<T> {
  attributes: T;
  getTitle(): string[];
  getTimeout(): number;
  setTimeout(timeout: number): void;
  getSlowThreshold(): number;
  /**
   * If the test takes longer time to run than the slow threshold, it is
   * considered slow, and reporters may mark them in a special way.
   */
  setSlowThreshold(slowThreshold: number): void;
  /**
   * Leaves a breadcrumb. Reporters may use breadcrumbs to provide error reporting.
   */
  leaveBreadcrumb(message: string, trace: string): void;
  /**
   * Emits debug info. Reporters may use debug info in various ways. Overman does not
   * use debug info messages; it merely provides them as a means of communicating
   * between tests and custom interfaces and custom reporters.
   */
  emitDebugInfo<U>(name: string, value: U): void;
}
