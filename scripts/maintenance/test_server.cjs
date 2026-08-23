const express = require('express');
const app = express();
const server = app.listen(3000, () => {
  console.log('server listening on 3000');
});
