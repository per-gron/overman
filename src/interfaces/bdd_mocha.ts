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

import * as path from 'path';
import { SuiteEntry, TestEntry, TestInterface } from './interface';
import {
  AsyncFunc,
  Context,
  Func,
  HookFunction,
  SuiteContext,
  SuiteContextImpl,
} from './bdd_mocha_context';

const moduleCache: Record<string, SuiteEntry> = {};

type ContextT<T> = T extends Context<infer U> ? U : never;

const testInterface: TestInterface = (_, file, runtimeContext) => {
  const absoluteFile = path.resolve(file);

  if (absoluteFile in moduleCache) {
    return moduleCache[absoluteFile];
  }

  const context = new Context(runtimeContext);
  global.context = context;
  type T = ContextT<typeof context>;

  let suiteContext: SuiteContextImpl<unknown> | undefined;
  let suite: SuiteEntry = { type: 'suite', contents: [] };

  function hookHandler(type: 'before' | 'after'): HookFunction<T> {
    return <F extends Func<T> | AsyncFunc<T>>(nameOrFn: string | F, fn?: F) => {
      let name: string | undefined;

      if (typeof nameOrFn === 'string') {
        name = nameOrFn;
      } else {
        fn = nameOrFn;
        name = fn.name ? fn.name : undefined;
      }

      if (typeof fn !== 'function') {
        throw new Error(`Got invalid hook function ${fn}`);
      }
      const run = fn.bind(context);

      suite[type] = [...(suite[type] ?? []), name ? { name, run } : { run }];
    };
  }

  function testForDuplicate(type: 'suite' | 'test', name: string) {
    if (suite.contents?.find((test) => test.name === name)) {
      throw new Error(`Redefining ${type} "${name}"`);
    }
  }

  // Since we always run only one test per process, there is no difference between
  // a hook that runs before every test and a hook that runs before a test suite.
  global.before = global.beforeEach = hookHandler('before');
  global.after = global.afterEach = hookHandler('after');

  type Options = Pick<SuiteEntry, 'skipped' | 'only' | 'unstable'>;

  function describe<
    T,
    U extends Record<string, unknown>,
    F extends (this: SuiteContext<T & U>) => void
  >(options: Options, name: string, attributesOrFn?: F | U, fn?: F) {
    testForDuplicate('suite', name);

    let attributes: U | undefined = undefined;

    if (typeof attributesOrFn === 'function') {
      fn = attributesOrFn;
    } else {
      attributes = attributesOrFn;
    }

    const [parentSuite, parentContext] = [suite, suiteContext];

    const subSuite: SuiteEntry = { type: 'suite', contents: [], ...options, name };

    if (!fn) {
      subSuite.skipped = true;
    }

    suite = subSuite;

    if (parentSuite.attributes || attributes) {
      suite.attributes = { ...parentSuite.attributes, ...attributes };
    }

    const ctx = new SuiteContextImpl(suiteContext, suite.attributes as T & U);
    suiteContext = ctx;

    if (fn) {
      fn.apply(ctx);
    }
    suiteContext = parentContext;
    suite = parentSuite;

    const { contents = [] } = suite;
    suite.contents = [...contents, { ...ctx.getParameters(), ...subSuite }];
  }

  global.describe = Object.assign(describe.bind(this, {}), {
    skip: describe.bind(this, { skipped: true }),
    only: describe.bind(this, { only: true }),
    unstable: describe.bind(this, { unstable: true }),
  });

  function it<T, U extends Record<string, unknown>, F extends Func<T & U> | AsyncFunc<T & U>>(
    options: Options,
    name: string,
    attributesOrFn?: F | U,
    fn?: F
  ) {
    testForDuplicate('test', name);

    let attributes: U | undefined = undefined;

    if (typeof attributesOrFn === 'function') {
      fn = attributesOrFn;
    } else {
      attributes = attributesOrFn;
    }

    const test: TestEntry = { type: 'test', ...options, name };

    if (!fn) {
      test.skipped = true;
    }
    if (suite.attributes || attributes) {
      test.attributes = { ...suite.attributes, ...attributes };
    }
    if (fn) {
      test.run = fn.bind(context as Context<T & U>);
    }

    const { contents = [] } = suite;
    suite.contents = [...contents, test];
  }

  global.it = Object.assign(it.bind(this, {}), {
    skip: it.bind(this, { skipped: true }),
    only: it.bind(this, { only: true }),
    unstable: it.bind(this, { unstable: true }),
  });

  require(absoluteFile);

  moduleCache[absoluteFile] = suite;

  return suite;
};

export default testInterface;
