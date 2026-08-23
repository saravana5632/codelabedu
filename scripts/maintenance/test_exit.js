process.on('exit', (code) => {
  console.log('Process exiting with code', code);
});
require('./dist/server.cjs');
