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

async function testUnshare() {
  try {
    // First get groups to see the structure
    console.log('Getting groups...');
    const groupsRes = await axios.get('http://localhost:3001/groups');
    const groups = groupsRes.data;
    console.log('Groups found:', groups.length);

    // Find a group with shared files
    const groupWithSharedFiles = groups.find(g => g.sharedFiles && g.sharedFiles.length > 0);
    if (!groupWithSharedFiles) {
      console.log('No group with shared files found');
      return;
    }

    console.log('Group with shared files:', groupWithSharedFiles.name);
    console.log('Shared files:', groupWithSharedFiles.sharedFiles.length);

    // Take the first shared file
    const sharedFile = groupWithSharedFiles.sharedFiles[0];
    console.log('Shared file object:', JSON.stringify(sharedFile, null, 2));
    console.log('Shared file _id:', sharedFile._id);

    // Test unshare
    console.log('Testing unshare...');
    const unshareRes = await axios.patch(`http://localhost:3001/groups/${groupWithSharedFiles._id}/unshare`, {
      type: 'file',
      itemId: sharedFile._id
    });
    console.log('Unshare response:', unshareRes.data);

    // Check if it was actually removed
    const groupsRes2 = await axios.get('http://localhost:3001/groups');
    const updatedGroup = groupsRes2.data.find(g => g._id === groupWithSharedFiles._id);
    console.log('Shared files after unshare:', updatedGroup.sharedFiles.length);

  } catch (error) {
    console.log('Error:', error.response ? error.response.status : error.message);
    if (error.response) {
      console.log('Response data:', error.response.data);
    }
  }
}

// testDelete();
testUnshare();
