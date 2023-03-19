import InternalReporter from '../reporters/internal_reporter';
import { Message } from '../reporters/message';
import { RegisterOptions } from '../reporters/reporter';
import { TestPath } from '../test_path';

export default class FakeInternalReporter implements InternalReporter {
  registerTestsCalls: [TestPath[], RegisterOptions][] = [];
  registrationFailedCalls: [Error][] = [];
  gotMessageCalls: [TestPath, Message][] = [];
  doneCalls: [][] = [];

  registerTests(...args: [TestPath[], RegisterOptions]) {
    this.registerTestsCalls.push(args);
  }
  registrationFailed(...args: [Error]) {
    this.registrationFailedCalls.push(args);
  }
  gotMessage(...args: [TestPath, Message]) {
    this.gotMessageCalls.push(args);
  }
  done(...args: []) {
    this.doneCalls.push(args);
  }
}
