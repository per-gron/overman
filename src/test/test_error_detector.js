var ErrorDetectorReporter = require('../reporters/error_detector');
var expect = require('chai').expect;

describe('Error Detector', function () {
  it('should have default values when created', function () {
    var errorDetector = new ErrorDetectorReporter();
    expect(errorDetector.didFail()).to.be.false;
    expect(errorDetector.testPath()).to.equal('');
    expect(errorDetector.message()).to.equal('');
  });

  it('should fail when result is unknown', function () {
    var errorDetector = new ErrorDetectorReporter();
    errorDetector.gotMessage('foopath', { type: 'finish', result: 'unknown' });
    expect(errorDetector.didFail()).to.be.true;
  });

  it('should not fail when result is success or skipped', function () {
    var errorDetector = new ErrorDetectorReporter();
    errorDetector.gotMessage('foopath', { type: 'finish', result: 'success' });
    expect(errorDetector.didFail()).to.be.false;
    errorDetector.gotMessage('foopath', { type: 'finish', result: 'skipped' });
    expect(errorDetector.didFail()).to.be.false;
  });

  it('should have proper values when failing', function () {
    var errorDetector = new ErrorDetectorReporter();
    errorDetector.gotMessage('foopath', { type: 'finish', result: ' success' });
    expect(errorDetector.didFail()).to.be.true;
    expect(errorDetector.testPath()).to.equal('foopath');
    expect(errorDetector.message().type).to.equal('finish');
    expect(errorDetector.message().result).to.equal(' success');
  });
});
