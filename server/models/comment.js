const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true }, // file or folder ID
  itemType: { type: String, enum: ["file", "folder"], required: true },
  content: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  createdAt: { type: Date, default: Date.now },
  parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null }, // for replies
  replies: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }]
});

module.exports = mongoose.model("Comment", CommentSchema);
