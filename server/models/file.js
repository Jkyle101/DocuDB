// models/File.js
const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
  filename:      { type: String, required: true },
  originalName:  { type: String, required: true },
  mimetype:      { type: String, required: true },
  size:          { type: Number, required: true },
  uploadDate:    { type: Date, default: Date.now },
  // Keep as String for simplicity since you're reading from localStorage.
  // (You can switch to ObjectId later if you add JWT-based auth.)
  userId:        { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true }, 
  parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: "folders", default: null }, 

  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  permissions: { type: String, enum: ["read", "write", "owner"], default: "owner" },
});

module.exports = mongoose.model("File", FileSchema);
