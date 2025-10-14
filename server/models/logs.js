const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  action: String, // e.g., "upload", "delete", "login"
  details: String,
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Log", logSchema);
