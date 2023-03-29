import { TestInterface, RuntimeContext } from './interface';

async function importInterface(path: string): Promise<TestInterface> {
  const testInterface = await import(path);
  if (typeof testInterface !== 'function') {
    return testInterface.default;
  }
  return testInterface;
}

export default async function <T>(
  interfacePath: string,
  param: string,
  file: string,
  ctx?: RuntimeContext<T>
) {
  const exec = await importInterface(interfacePath);
  return exec(param, file, ctx);
}
