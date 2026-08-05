const axios = require('axios');
const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 1, role: 'faculty' }, "codelab-secret-key-123");

axios.delete('http://localhost:3000/api/faculty/questions/3', {
  headers: { Authorization: `Bearer ${token}` }
}).then(res => console.log(res.data)).catch(err => console.log(err.response?.data || err.message));
