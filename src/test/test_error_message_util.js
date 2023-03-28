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

'use strict';

var chalk = require('chalk');
var expect = require('chai').expect;
var stripAnsi = require('strip-ansi');
var errorMessageUtil = require('../error_message_util');

describe('Error message utilities', function () {
  before(function () {
    chalk.enabled = true;
  });

  describe('prettyErrorLocation', function () {
    it('should return a string even given no input', function () {
      expect(errorMessageUtil.prettyErrorLocation()).to.be.equal('Unknown location');
    });

    it('should pretty print before hooks', function () {
      expect(errorMessageUtil.prettyErrorLocation({ in: 'beforeHook' })).to.be.equal(
        'In before hook'
      );
    });

    it('should pretty print after hooks', function () {
      expect(errorMessageUtil.prettyErrorLocation({ in: 'afterHook' })).to.be.equal(
        'In after hook'
      );
    });

    it('should pretty print tests', function () {
      expect(errorMessageUtil.prettyErrorLocation({ in: 'test' })).to.be.equal('In test');
    });

    it('should pretty print uncaught errors', function () {
      expect(errorMessageUtil.prettyErrorLocation({ in: 'uncaught' })).to.be.equal(
        'Uncaught error'
      );
    });

    it('should include hook names when provided', function () {
      expect(
        errorMessageUtil.prettyErrorLocation({
          in: 'beforeHook',
          inName: 'do stuff',
        })
      ).to.be.equal('In before hook "do stuff"');
    });
  });

  describe('prettyError', function () {
    it('should return a string even given no input', function () {
      expect(errorMessageUtil.prettyError()).to.be.equal('[No error]');
    });

    it('should include location when present', function () {
      var pretty = errorMessageUtil.prettyError({ in: 'beforeHook' });
      expect(stripAnsi(pretty)).to.match(/^In before hook:/);
    });

    it('should color location', function () {
      var pretty = errorMessageUtil.prettyError({ in: 'beforeHook' });
      expect(pretty).to.match(/\u001b\[36mIn .*:\u001b\[39m/);
    });

    it('should include error header', function () {
      var pretty = errorMessageUtil.prettyError({ stack: 'The Error' });
      expect(stripAnsi(pretty)).to.be.equal('The Error\n');
    });

    it('should color error header', function () {
      var pretty = errorMessageUtil.prettyError({ stack: '  The Error  ' });
      expect(pretty).to.match(/^\u001b\[31m  The Error  \u001b\[39m/);
    });

    it('should color error trace', function () {
      var pretty = errorMessageUtil.prettyError({ stack: 'The Error\nabc\ndef' });
      expect(pretty).to.include('\n\u001b[90mabc\u001b[39m\n');
      expect(pretty).to.include('\n\u001b[90mdef\u001b[39m\n');
    });

    it('should de-indent deep error indentation', function () {
      var pretty = stripAnsi(
        errorMessageUtil.prettyError({ stack: 'The Error\n    abc\n    def' })
      );
      expect(pretty).to.include('\n  abc\n');
      expect(pretty).to.include('\n  def\n');
    });
  });

  describe('prettyTimeout', function () {
    it('should provide the right information', function () {
      expect(stripAnsi(errorMessageUtil.prettyTimeout({ in: 'test' }))).to.be.equal(
        'In test: Timed out\n'
      );
    });

    it('should be colored properly', function () {
      expect(errorMessageUtil.prettyTimeout({ in: 'test' })).to.be.equal(
        '\u001b[36mIn test:\u001b[39m \u001b[31mTimed out\u001b[39m\n'
      );
    });
  });

  describe('prettyBreadcrumb', function () {
    var breadcrumb = {
      message: 'msg',
      trace: 'a\nb',
    };

    it('should provide the right information', function () {
      expect(stripAnsi(errorMessageUtil.prettyBreadcrumb(breadcrumb, 'In'))).to.be.equal(
        'In: msg\na\nb\n'
      );
    });

    it('should work without the place information', function () {
      expect(stripAnsi(errorMessageUtil.prettyBreadcrumb(breadcrumb))).to.be.equal('msg\na\nb\n');
    });

    it('should be colored properly', function () {
      expect(errorMessageUtil.prettyBreadcrumb(breadcrumb, 'In')).to.be.equal(
        '\u001b[36mIn: \u001b[39mmsg\n\u001b[90ma\u001b[39m\n\u001b[90mb\u001b[39m\n'
      );
    });
  });

  describe('indent', function () {
    it('should leave strings when not given indent parameter', function () {
      expect(errorMessageUtil.indent('a\nb')).to.be.equal('a\nb');
    });

    it('should indent single line strings', function () {
      expect(errorMessageUtil.indent('abc', 3)).to.be.equal('   abc');
    });

    it('should indent multiline strings', function () {
      expect(errorMessageUtil.indent('abc\ndef', 2)).to.be.equal('  abc\n  def');
    });

    it('should not indent trailing newlines', function () {
      expect(errorMessageUtil.indent('abc\n', 3)).to.be.equal('   abc\n');
    });

    it('should not indent lines with only whitespace', function () {
      expect(errorMessageUtil.indent('abc\n \t\ndef', 2)).to.be.equal('  abc\n \t\n  def');
    });
  });
});
