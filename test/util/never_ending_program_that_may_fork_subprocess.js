if (process.argv[2] === 'fork') {
  require('child_process').fork(__dirname + '/../util/never_ending_program_that_may_fork_subprocess.js', ['empty']);
}

setInterval(function() {}, 1000);
