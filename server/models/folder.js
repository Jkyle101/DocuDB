const mongoose = require("mongoose");

const complianceTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "complete"],
      default: "not_started",
    },
    scope: { type: String, default: "" },
    checks: [{ type: String }],
    assignedUploaders: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    assignedProgramChairs: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    assignedQaOfficers: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    children: [],
  },
  { _id: true }
);

complianceTaskSchema.add({ children: [complianceTaskSchema] });

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  parentFolder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
  isPredefinedRoot: { type: Boolean, default: false },
  predefinedTemplateKey: { type: String, default: null },

  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  permissions: { type: String, enum: ["viewer", "editor", "owner", "read", "write"], default: "owner" },
  complianceProfileKey: { type: String, default: null },
  complianceTasks: [complianceTaskSchema],
  folderAssignments: {
    uploaders: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    programChairs: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    qaOfficers: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    evaluators: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  },
  complianceReviews: [
    {
      reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
      role: { type: String, required: true },
      scope: { type: String, default: "" },
      checks: [{ type: String }],
      notes: { type: String, default: "" },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  copc: {
    isProgramRoot: { type: Boolean, default: false },
    programCode: { type: String, default: "" },
    programName: { type: String, default: "" },
    departmentName: { type: String, default: "" },
    year: { type: Number, default: null },
    workflowStage: {
      type: String,
      enum: [
        "initialized",
        "collecting_documents",
        "department_review",
        "qa_verification",
        "internal_evaluation",
        "revision",
        "package_compiled",
        "copc_ready",
        "submitted",
        "archived",
      ],
      default: "initialized",
    },
    workflowStatus: { type: String, default: "In Progress" },
    packageMeta: {
      fileName: { type: String, default: "" },
      generatedAt: { type: Date, default: null },
      generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    },
    submissionMeta: {
      method: { type: String, default: "" },
      reference: { type: String, default: "" },
      submittedAt: { type: Date, default: null },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    },
    archiveMeta: {
      archiveYear: { type: Number, default: null },
      archivedAt: { type: Date, default: null },
    },
    observations: [
      {
        by: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
        role: { type: String, default: "" },
        message: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    locked: {
      isLocked: { type: Boolean, default: false },
      lockedAt: { type: Date, default: null },
      lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    },
  },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Folder", folderSchema);
