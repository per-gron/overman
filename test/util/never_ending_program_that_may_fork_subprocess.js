if (process.argv[2] === 'fork') {
  proc = require('child_process').fork(__dirname + '/../util/never_ending_program_that_may_fork_subprocess.js', ['empty']);
  // Forward messages from fork
  proc.on('message', function(data) {
    process.send(data);
  });
} else {
  // Send a message that forking is done
  process.send({ state: 'forked' });
}

setInterval(function() {}, 1000);
