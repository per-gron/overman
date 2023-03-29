/*
 * Copyright 2014 Per Eckerdal
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

import execInterface from '../interfaces/exec';
import { ChildEntry, SuiteEntry } from '../interfaces/interface';
import { TestSpec } from '../test_spec';

/**
 * This file is a runnable script that takes two command line arguments:
 *
 * 1) An absolute path to the test interface
 * 2) An absolute path to the suite file
 *
 * Its output is a list of the tests that are declared in the suite file,
 * in JSON format to stdout.
 */

function defined<T extends object>(t: T) {
  return Object.fromEntries(
    Object.entries(t).flatMap(([k, v]) => (v !== undefined ? [[k, v]] : []))
  );
}

type Properties = Pick<
  SuiteEntry,
  'skipped' | 'only' | 'unstable' | 'timeout' | 'slow' | 'attributes'
>;

function testsOfSuite(
  file: string,
  child: ChildEntry,
  parentPath: string[] = [],
  properties: Properties = {}
): TestSpec[] {
  const { name, type, attributes, skipped, only, unstable } = child;

  if (attributes) {
    properties.attributes = { ...properties.attributes, ...attributes };
  }
  if (type === 'test') {
    if (!name) {
      throw new Error(`Missing test name`);
    }
    const path = { file, path: [...parentPath, name] };
    return [{ path, skipped, only, unstable, ...defined(properties) }];
  }
  if (type === 'suite') {
    const { contents = [] } = child;
    const path = name ? [...parentPath, name] : parentPath;
    return contents
      .map((child) => {
        const { skipped, only, unstable } = child;
        const { timeout = undefined, slow = undefined } = child.type === 'suite' ? child : {};
        return testsOfSuite(file, child, path, {
          ...{ skipped, only, unstable, timeout, slow },
          ...defined(properties),
        });
      })
      .flat();
  }

  throw new Error(`Unrecognized suite type ${type}`);
}

async function main() {
  const [testInterfacePath, testInterfaceParameter, testFile] = process.argv.slice(2);
  const suite = await execInterface(testInterfacePath, testInterfaceParameter, testFile);
  console.log(JSON.stringify(testsOfSuite(testFile, suite)));
}

main();
