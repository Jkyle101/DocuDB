const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  action: {
    type: String,
    enum: ["upload", "view", "download", "share", "delete", "modify", "login", "logout"],
    required: true
  },
  resourceType: {
    type: String,
    enum: ["file", "folder", "user"],
    required: true
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster querying
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);