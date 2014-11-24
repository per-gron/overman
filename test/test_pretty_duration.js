'use strict';

var expect = require('chai').expect;
var prettyDuration = require('../lib/pretty_duration');

describe('Pretty duration', function() {
  it('should properly handle zero', function() {
    expect(prettyDuration(0)).to.be.equal('0s');
  });

  it('should properly handle short times', function() {
    expect(prettyDuration(110)).to.be.equal('0s');
  });

  it('should report seconds', function() {
    expect(prettyDuration(2345)).to.be.equal('2s');
  });

  it('should report minutes', function() {
    expect(prettyDuration(120001)).to.be.equal('2m');
  });

  it('should report hours', function() {
    expect(prettyDuration(7199999)).to.be.equal('2h');
  });

  it('should report minutes and seconds', function() {
    expect(prettyDuration(100001)).to.be.equal('2m 40s');
  });

  it('should report hours and seconds', function() {
    expect(prettyDuration(3601000)).to.be.equal('1h 1s');
  });

  it('should report hours and minutes and seconds', function() {
    expect(prettyDuration(3801000)).to.be.equal('1h 3m 21s');
  });
});
