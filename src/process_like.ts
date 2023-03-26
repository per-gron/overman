import { Serializable } from 'child_process';
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

export interface ProcessLike extends EventEmitter {
  stdin: Writable | null;
  stdout: Readable | null;
  stderr: Readable | null;
  kill(signal: NodeJS.Signals): void;
  send(message: Serializable): void;
}
