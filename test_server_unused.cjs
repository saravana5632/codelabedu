const express = require('express');
const app = express();
app.listen(3005, (err) => {
  if (err) console.error(err);
  else console.log('server listening on 3005');
});
