const express = require('express');
const app = express();
app.listen(3002, '0.0.0.0', () => {
  console.log('min server');
});
