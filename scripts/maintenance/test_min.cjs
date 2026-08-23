const express = require('express');
const app = express();
const server = app.listen(3000, '0.0.0.0', (err) => {
  console.log('err?', err);
  console.log('min server');
});
