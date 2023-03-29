import { TestPath } from '../test_path';
import { Message } from './message';
import { RegisterOptions } from './reporter';

/**
 * Used internally, implmented by the TimestamperReporter.
 */
export default interface InternalReporter<MessageT extends Message = Message> {
  registerTests(tests: TestPath[], options: RegisterOptions): void;
  registrationFailed(error: Error): void;
  gotMessage(testPath: TestPath, message: MessageT): void;
  done(): void;
}
