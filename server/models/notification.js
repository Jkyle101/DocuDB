const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: [
      "SHARE_FILE",
      "SHARE_FOLDER",
      "COMMENT",
      "PASSWORD_CHANGE_REQUEST",
      "PASSWORD_CHANGE_APPROVED",
      "PASSWORD_CHANGE_REJECTED",
      "GROUP_INVITE",
      "UPLOAD",
      "CREATE_FOLDER"
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    // Can reference files, folders, groups, etc.
  },
  relatedModel: {
    type: String,
    enum: ["File", "Folder", "Group", "Comment", "User"]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  date: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
