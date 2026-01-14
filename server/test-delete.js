const axios = require('axios');

async function testDelete() {
  try {
    console.log('Testing DELETE /groups/6965bff63039c3e113db28af');
    const response = await axios.delete('http://localhost:3001/groups/6965bff63039c3e113db28af');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('Error:', error.response ? error.response.status : error.message);
    if (error.response) {
      console.log('Response data:', error.response.data);
    }
  }
}

testDelete();
