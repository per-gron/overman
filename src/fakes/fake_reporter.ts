import { Message } from '../reporters/message';
import Reporter, { RegisterOptions } from '../reporters/reporter';
import { TestPath } from '../test_path';

export default class FakeReporter implements Reporter {
  registerTestsCalls: [TestPath[], RegisterOptions, Date][] = [];
  registrationFailedCalls: [Error, Date][] = [];
  gotMessageCalls: [TestPath, Message, Date][] = [];
  doneCalls: [Date][] = [];

  registerTests(...args: [TestPath[], RegisterOptions, Date]) {
    this.registerTestsCalls.push(args);
  }
  registrationFailed(...args: [Error, Date]) {
    this.registrationFailedCalls.push(args);
  }
  gotMessage(...args: [TestPath, Message, Date]) {
    this.gotMessageCalls.push(args);
  }
  done(...args: [Date]) {
    this.doneCalls.push(args);
  }
}
