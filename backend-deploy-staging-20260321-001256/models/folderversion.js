const mongoose = require("mongoose");

const FolderVersionSchema = new mongoose.Schema({
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", required: true },
  versionNumber: { type: Number, required: true },
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  createdAt: { type: Date, default: Date.now },
  changeDescription: { type: String, default: "" },
  changes: { type: mongoose.Schema.Types.Mixed }, // stores changes like moved files, renamed, etc.
  isCurrent: { type: Boolean, default: false }
});

module.exports = mongoose.model("FolderVersion", FolderVersionSchema);
