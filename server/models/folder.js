const mongoose = require("mongoose");

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: "folders", default: null },

  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  permissions: { type: String, enum: ["read", "write", "owner"], default: "owner" },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Folder", folderSchema);
