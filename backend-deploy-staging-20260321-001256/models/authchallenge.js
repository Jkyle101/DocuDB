const mongoose = require("mongoose");

const authChallengeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    default: null,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  purpose: {
    type: String,
    enum: ["password_reset", "registration"],
    required: true,
  },
  codeHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  attemptCount: {
    type: Number,
    default: 0,
  },
  consumedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

authChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authChallengeSchema.index({ email: 1, purpose: 1, createdAt: -1 });

module.exports = mongoose.model("AuthChallenge", authChallengeSchema);
