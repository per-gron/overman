import { TestPath } from './test_path';

export interface TestSpec {
  path: TestPath;
  skipped?: boolean;
  only?: boolean;
  unstable?: boolean;
  timeout?: number;
  slow?: number;
  attributes?: Record<string, unknown>;
}
