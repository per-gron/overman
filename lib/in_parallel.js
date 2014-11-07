var when = require('when');
var fn = require('when/function');

/**
 * Takes an array of functions that may return a value or a promise
 * and runs them in parallel, but at most parallelism promises will
 * be allowed to be unresolved at any given time.
 *
 * Returns a promise of an array of the results of the functions.
 * The functions that failed will have their error as their value.
 * The returned promise never fails.
 *
 * This is how we run N tests in parallel.
 */
module.exports = function executeFunctionsInParallel(functions, parallelism) {
  return when.promise(function(resolve) {
    var startedFunctions = 0;
    var finishedFunctions = 0;
    var results = [];

    function process() {
      if (results && finishedFunctions >= functions.length) {
        resolve(finishedFunctions);
        results = null;  // Mark ourselves as done so we don't resolve twice
        return;
      } else if (startedFunctions >= functions.length) {
        // No more work to do
        return;
      }

      var functionToRun = startedFunctions++;
      function handleFinish(value) {
        results[functionToRun] = value;
        process();
      }
      fn.call(functions[functionToRun])
        .done(handleFinish, handleFinish);
    }

    for (var i = 0; i < parallelism; i++) {
      process();
    }
  });
};
