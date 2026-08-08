const net = require('net');
net.createServer().listen(3000, () => {
  console.log('net listening on 3000');
});
