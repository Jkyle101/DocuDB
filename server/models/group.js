const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  leaders: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  createdAt: { type: Date, default: Date.now },
  notifications: [{
    title: { type: String, required: true },
    message: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    createdAt: { type: Date, default: Date.now }
  }],
  announcements: [{
    title: { type: String, required: true },
    content: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    createdAt: { type: Date, default: Date.now }
  }],
  sharedFiles: [{
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "files", required: true },
    permission: { type: String, enum: ["read", "write"], default: "read" },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    sharedAt: { type: Date, default: Date.now }
  }],
  sharedFolders: [{
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: "folders", required: true },
    permission: { type: String, enum: ["read", "write"], default: "read" },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    sharedAt: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model("Group", groupSchema);
