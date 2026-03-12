// models/File.js
const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
  filename:      { type: String, required: true },
  originalName:  { type: String, required: true },
  mimetype:      { type: String, required: true },
  size:          { type: Number, required: true },
  uploadDate:    { type: Date, default: Date.now },
  lastAccessedAt: { type: Date, default: null },
  // Keep as String for simplicity since you're reading from localStorage.
  // (You can switch to ObjectId later if you add JWT-based auth.)
  userId:        { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },

  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  permissions: { type: String, enum: ["viewer", "editor", "owner", "read", "write"], default: "owner" },
  deletedAt: { type: Date, default: null },
  favoritedBy: [{ type: String }],
  pinnedBy: [{ type: String }],
  contentHash: { type: String, index: true, default: null },
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "File", default: null },
  classification: {
    category: { type: String, default: "General Document" },
    confidence: { type: Number, default: 0.5 },
    tags: [{ type: String }],
    classifiedAt: { type: Date, default: Date.now },
    classifierVersion: { type: String, default: "v1" },
  },
  reviewWorkflow: {
    requiresReview: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "approved",
        "pending_program_chair",
        "pending_qa",
        "rejected_program_chair",
        "rejected_qa",
      ],
      default: "approved",
    },
    assignedProgramChairs: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    assignedQaOfficers: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    programChair: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "not_required"],
        default: "not_required",
      },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
      reviewedAt: { type: Date, default: null },
      notes: { type: String, default: "" },
    },
    qaOfficer: {
      status: {
        type: String,
        enum: ["pending", "approved", "rejected", "not_required"],
        default: "not_required",
      },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
      reviewedAt: { type: Date, default: null },
      notes: { type: String, default: "" },
    },
    verificationBadge: {
      verified: { type: Boolean, default: false },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
      verifiedAt: { type: Date, default: null },
      label: { type: String, default: "Pending Verification" },
    },
  },

});

module.exports = mongoose.model("File", FileSchema);
