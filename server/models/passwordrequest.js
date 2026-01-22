const mongoose = require("mongoose");

const passwordRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  currentPassword: {
    type: String,
    required: true
  },
  newPassword: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  reviewNotes: {
    type: String
  }
});

// Index for efficient queries
passwordRequestSchema.index({ userId: 1, status: 1 });
passwordRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PasswordRequest", passwordRequestSchema);
