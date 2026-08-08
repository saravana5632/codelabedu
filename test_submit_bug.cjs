const axios = require('axios');
const fs = require('fs');

async function test() {
  const token = fs.readFileSync('student_token.txt', 'utf8').trim();
  try {
    const res = await axios.post('http://localhost:3000/api/student/submit', {
      submissions: [{ question_id: 1, language: "Python" }]
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(res.status, res.data);
  } catch (err) {
    console.error(err.response?.status, err.response?.data);
  }
}
test();
