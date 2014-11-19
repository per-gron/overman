'use strict'

it('should print to stderr', function() {
  process.stderr.write('printing_to_stderr\n');
});
