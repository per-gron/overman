import ErrorDetectorReporter from '../reporters/error_detector';
import { expect } from 'chai';
import { FinishMessage } from '../reporters/message';

describe('Error Detector', function () {
  it('should have default values when created', function () {
    const errorDetector = new ErrorDetectorReporter();
    expect(errorDetector.didFail()).to.be.false;
    expect(errorDetector.testPath()).to.equal(null);
    expect(errorDetector.message()).to.equal(null);
  });

  it('should fail when result is unknown', function () {
    const errorDetector = new ErrorDetectorReporter();
    errorDetector.gotMessage(
      { file: 'foopath', path: [] },
      { type: 'finish', result: 'aborted', unstable: false }
    );
    expect(errorDetector.didFail()).to.be.true;
  });

  it('should not fail when result is success or skipped', function () {
    const errorDetector = new ErrorDetectorReporter();
    errorDetector.gotMessage(
      { file: 'foopath', path: [] },
      { type: 'finish', result: 'success', unstable: false }
    );
    expect(errorDetector.didFail()).to.be.false;
    errorDetector.gotMessage(
      { file: 'foopath', path: [] },
      { type: 'finish', result: 'skipped', unstable: false }
    );
    expect(errorDetector.didFail()).to.be.false;
  });

  it('should have proper values when failing', function () {
    const errorDetector = new ErrorDetectorReporter();
    errorDetector.gotMessage(
      { file: 'foopath', path: [] },
      {
        type: 'finish',
        result: 'failure',
        unstable: false,
      }
    );
    expect(errorDetector.didFail()).to.be.true;
    expect(errorDetector.testPath()).to.deep.equal({ file: 'foopath', path: [] });
    const message = errorDetector.message();
    expect(message!.type).to.equal('finish');
    expect((message as FinishMessage).result).to.equal('failure');
  });
});
