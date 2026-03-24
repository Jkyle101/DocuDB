const mongoose = require("mongoose");

const taskAttachmentSchema = new mongoose.Schema(
  {
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: "File", default: null },
    name: { type: String, default: "" },
    url: { type: String, default: "" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const taskCommentSchema = new mongoose.Schema(
  {
    message: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    attachments: [taskAttachmentSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: null },
  },
  { _id: true }
);

const taskHistorySchema = new mongoose.Schema(
  {
    action: { type: String, default: "" },
    fromStatus: { type: String, default: "" },
    toStatus: { type: String, default: "" },
    notes: { type: String, default: "" },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const complianceTaskSchema = new mongoose.Schema(
  {
    taskId: { type: String, default: "" },
    taskType: {
      type: String,
      enum: ["document", "review", "approval", "monitoring", "general"],
      default: "general",
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    folderPath: { type: String, default: "" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    assignedRole: {
      type: String,
      enum: ["faculty", "dept_chair", "qa_admin", "superadmin", "evaluator", ""],
      default: "faculty",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    dueDate: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    status: {
      type: String,
      enum: [
        "pending",
        "in_progress",
        "for_review",
        "approved",
        "rejected",
        "not_started",
        "complete",
      ],
      default: "pending",
    },
    scope: { type: String, default: "" },
    checks: [{ type: String }],
    attachments: [taskAttachmentSchema],
    comments: [taskCommentSchema],
    history: [taskHistorySchema],
    source: {
      type: String,
      enum: ["manual", "folder_auto", "recurring"],
      default: "manual",
    },
    recurrence: {
      enabled: { type: Boolean, default: false },
      frequency: {
        type: String,
        enum: ["yearly", "quarterly", "monthly", "custom", ""],
        default: "",
      },
      interval: { type: Number, default: 1, min: 1 },
      nextDueDate: { type: Date, default: null },
      lastGeneratedAt: { type: Date, default: null },
    },
    assignedUploaders: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    assignedProgramChairs: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    assignedQaOfficers: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
    children: [],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
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
    uploaderGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }],
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
    description: { type: String, default: "" },
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
