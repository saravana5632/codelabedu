process.on('exit', (code) => {
  console.log('Process exiting with code', code);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err);
});
require('./dist/server.cjs');
