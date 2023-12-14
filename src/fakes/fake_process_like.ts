import { Serializable } from 'child_process';
import { EventEmitter } from 'events';
import { Writable, Readable } from 'stream';
import { ProcessLike } from '../process_like';

export { Serializable };

export class FakeProcess<T extends Serializable = Serializable>
  extends EventEmitter
  implements ProcessLike
{
  constructor(
    public kill = (_: NodeJS.Signals) => {},
    public send = (_: T) => {},
    public stdin: Writable | null = null,
    public stdout: Readable | null = null,
    public stderr: Readable | null = null,
    public connected = true
  ) {
    super();
  }
}
