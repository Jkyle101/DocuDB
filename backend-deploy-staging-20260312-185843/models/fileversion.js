const mongoose = require("mongoose");

const FileVersionSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: "File", required: true },
  versionNumber: { type: Number, required: true },
  originalName: { type: String, required: true },
  filename: { type: String, required: true }, // stored filename for this version
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  createdAt: { type: Date, default: Date.now },
  changeDescription: { type: String, default: "" },
  isCurrent: { type: Boolean, default: false }
});

module.exports = mongoose.model("FileVersion", FileVersionSchema);
