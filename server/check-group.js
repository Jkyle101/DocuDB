require("dotenv").config();
const mongoose = require("mongoose");
const Group = require("./models/group");

async function checkGroup() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const groupId = "6965bff63039c3e113db28af";
    const group = await Group.findById(groupId);

    if (group) {
      console.log("Group found:", {
        id: group._id,
        name: group.name,
        description: group.description,
        createdBy: group.createdBy,
        members: group.members.length,
        createdAt: group.createdAt
      });
    } else {
      console.log("Group not found with ID:", groupId);
    }

    // Also check all groups
    const allGroups = await Group.find().select("_id name createdAt");
    console.log("All groups in database:");
    allGroups.forEach(g => console.log(`- ${g._id}: ${g.name} (${g.createdAt})`));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

checkGroup();
