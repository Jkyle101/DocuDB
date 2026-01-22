const mongoose = require("mongoose");
require("dotenv").config({ path: './.env' });

const FileVersion = require("./models/fileversion");
const FolderVersion = require("./models/folderversion");
const File = require("./models/file");
const Folder = require("./models/folder");

async function testVersions() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Check file versions
    const fileVersions = await FileVersion.find().populate("createdBy", "email").limit(5);
    console.log("\n=== FILE VERSIONS ===");
    console.log(`Total file versions: ${await FileVersion.countDocuments()}`);
    fileVersions.forEach((v, i) => {
      console.log(`${i+1}. File ${v.fileId} - Version ${v.versionNumber} - ${v.originalName} - Created by: ${v.createdBy?.email || 'Unknown'}`);
    });

    // Check folder versions
    const folderVersions = await FolderVersion.find().populate("createdBy", "email").limit(5);
    console.log("\n=== FOLDER VERSIONS ===");
    console.log(`Total folder versions: ${await FolderVersion.countDocuments()}`);
    folderVersions.forEach((v, i) => {
      console.log(`${i+1}. Folder ${v.folderId} - Version ${v.versionNumber} - ${v.name} - Created by: ${v.createdBy?.email || 'Unknown'}`);
    });

    // Check some files
    const files = await File.find().limit(3);
    console.log("\n=== SAMPLE FILES ===");
    files.forEach((f, i) => {
      console.log(`${i+1}. ${f.originalName} - ID: ${f._id}`);
    });

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

testVersions();
