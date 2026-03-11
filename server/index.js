const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, '.env') });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const archiver = require("archiver");

const UserModel = require("./models/users");
const File = require("./models/file");
const Folder = require("./models/folder");
const Group = require("./models/group");
const FileVersion = require("./models/fileversion");
const FolderVersion = require("./models/folderversion");
const Comment = require("./models/comment");
const FormTemplate = require("./models/formtemplate");

// NEW: logs model
const Log = require("./models/logs");
const PasswordRequest = require("./models/passwordrequest");
const Notification = require("./models/notification");
const { timeStamp } = require("console");

// Email service
const { sendNotificationEmail, sendEmail } = require("./emailService");

const app = express();

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function parseOriginList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter(Boolean);
}

function isPrivateIpv4(hostname) {
  const match = String(hostname || "").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isLanDevOrigin(origin) {
  try {
    const url = new URL(origin);
    const hostname = String(url.hostname || "").toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
    if (hostname.endsWith(".local")) return true;
    if (isPrivateIpv4(hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

const configuredCorsOrigins = [
  ...parseOriginList(process.env.CORS_ORIGINS),
  normalizeOrigin(process.env.CORS_ORIGIN),
  normalizeOrigin(process.env.FRONTEND_URL),
].filter(Boolean);

const hasExplicitCorsOrigins = configuredCorsOrigins.length > 0;
const allowLanCors = String(process.env.CORS_ALLOW_LAN || "true").toLowerCase() !== "false";
const allowedCorsOrigins = new Set(configuredCorsOrigins);

if (!hasExplicitCorsOrigins) {
  allowedCorsOrigins.add("http://localhost:5173");
  allowedCorsOrigins.add("http://127.0.0.1:5173");
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.has("*")) {
        return callback(null, true);
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedCorsOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }
      if (allowLanCors && isLanDevOrigin(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${normalizedOrigin}`));
    },
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

/* ========================
   LOGGING HELPER (non-destructive)
   - creates a Log document; failures are only logged to console
======================== */
async function createLog(action, userId = null, details = "") {
  try {
    await Log.create({
      user: userId,
      action,
      details: details || action,
      date: new Date(),
      timeStamp: new Date(),
    });
  } catch (err) {
    // don't throw — just record to console so we don't break endpoints
    console.error("createLog error:", err && err.message ? err.message : err);
  }
}

async function isGroupLeaderForFile(userId, fileId) {
  if (!userId || !fileId) return false;
  const group = await Group.findOne({
    leaders: userId,
    "sharedFiles.fileId": fileId
  }).select("_id");
  return !!group;
}

async function isAdminContext(role, userId) {
  if (normalizeRole(role) === "superadmin") return true;
  if (!userId) return false;
  try {
    const user = await UserModel.findById(userId).select("role");
    return normalizeRole(user?.role) === "superadmin";
  } catch {
    return false;
  }
}

const PROGRAM_CHAIR_ROLES = new Set(["dept_chair"]);
const QA_REVIEW_ROLES = new Set(["qa_admin"]);
const COMPLIANCE_VIEW_ROLES = new Set(["superadmin", "qa_admin", "dept_chair", "faculty", "evaluator"]);
const READ_ONLY_REVIEWER_ROLES = new Set(["evaluator"]);

function normalizeRole(role) {
  const value = String(role || "").toLowerCase();
  if (value === "admin") return "superadmin";
  if (value === "user") return "faculty";
  if (["program_chair", "department_chair", "program_head"].includes(value)) return "dept_chair";
  if (["qa_officer", "quality_assurance_admin", "copc_reviewer"].includes(value)) return "qa_admin";
  if (value === "reviewer") return "evaluator";
  return value;
}

async function resolveActorRole(userId, claimedRole) {
  const claimed = normalizeRole(claimedRole);
  if (!userId) return claimed;
  try {
    const user = await UserModel.findById(userId).select("role");
    if (user?.role) return normalizeRole(user.role);
  } catch (err) {
    console.error("resolveActorRole error:", err?.message || err);
  }
  return claimed;
}

function isUserAssignedTo(userId, assigned = []) {
  const target = String(userId || "");
  if (!target) return false;
  return (assigned || []).some((entry) => {
    const value = entry?._id?.toString?.() || entry?.toString?.();
    return String(value || "") === target;
  });
}

function canUploadDocuments(role) {
  return ["superadmin", "qa_admin", "dept_chair", "faculty"].includes(normalizeRole(role));
}

function canEditAnyDocuments(role) {
  return ["superadmin", "qa_admin", "dept_chair"].includes(normalizeRole(role));
}

function canDeleteDocuments(role) {
  return ["superadmin", "qa_admin"].includes(normalizeRole(role));
}

function canApproveDocuments(role) {
  return ["superadmin", "qa_admin", "dept_chair"].includes(normalizeRole(role));
}

function canGenerateReports(role) {
  return ["superadmin", "qa_admin", "dept_chair", "evaluator"].includes(normalizeRole(role));
}

function canManageUsers(role) {
  return normalizeRole(role) === "superadmin";
}

function hasGlobalViewAccess(role) {
  return normalizeRole(role) === "superadmin";
}

function isProgramChairRole(role) {
  return PROGRAM_CHAIR_ROLES.has(normalizeRole(role));
}

function isQaReviewRole(role) {
  return QA_REVIEW_ROLES.has(normalizeRole(role));
}

function canViewCompliance(role) {
  return COMPLIANCE_VIEW_ROLES.has(normalizeRole(role));
}

function isReadOnlyReviewerRole(role) {
  return READ_ONLY_REVIEWER_ROLES.has(normalizeRole(role));
}

function normalizeTaskNode(task = {}) {
  const allowedStatuses = new Set(["not_started", "in_progress", "complete"]);
  const status = allowedStatuses.has(task.status) ? task.status : "not_started";
  const percentage = Number.isFinite(Number(task.percentage))
    ? Math.max(0, Math.min(100, Number(task.percentage)))
    : status === "complete"
      ? 100
      : status === "in_progress"
        ? 50
        : 0;

  return {
    _id: task._id,
    title: String(task.title || "").trim() || "Untitled Task",
    description: String(task.description || ""),
    percentage,
    status,
    scope: String(task.scope || ""),
    checks: Array.isArray(task.checks) ? task.checks.filter(Boolean).map(String) : [],
    assignedUploaders: Array.isArray(task.assignedUploaders) ? task.assignedUploaders : [],
    assignedProgramChairs: Array.isArray(task.assignedProgramChairs) ? task.assignedProgramChairs : [],
    assignedQaOfficers: Array.isArray(task.assignedQaOfficers) ? task.assignedQaOfficers : [],
    children: Array.isArray(task.children) ? task.children.map(normalizeTaskNode) : [],
  };
}

function computeTaskProgress(tasks = []) {
  const normalized = (tasks || []).map(normalizeTaskNode);
  let nodes = 0;
  let total = 0;
  const walk = (arr) => {
    for (const task of arr || []) {
      nodes += 1;
      total += Number(task.percentage || 0);
      walk(task.children || []);
    }
  };
  walk(normalized);
  const progress = nodes ? Number((total / nodes).toFixed(2)) : 0;
  return { normalized, progress, totalNodes: nodes };
}

function findTaskById(tasks = [], taskId) {
  for (const task of tasks || []) {
    if (task?._id?.toString?.() === taskId?.toString?.()) return task;
    const found = findTaskById(task.children || [], taskId);
    if (found) return found;
  }
  return null;
}

function removeTaskById(tasks = [], taskId) {
  for (let i = 0; i < (tasks || []).length; i += 1) {
    const task = tasks[i];
    if (task?._id?.toString?.() === taskId?.toString?.()) {
      tasks.splice(i, 1);
      return task;
    }
    const removed = removeTaskById(task.children || [], taskId);
    if (removed) return removed;
  }
  return null;
}

function buildFileWorkflowFromFolder(folder) {
  const chairAssignments = folder?.folderAssignments?.programChairs || [];
  const qaAssignments = folder?.folderAssignments?.qaOfficers || [];
  const requiresReview = chairAssignments.length > 0 || qaAssignments.length > 0;
  const chairRequired = chairAssignments.length > 0;
  const qaRequired = qaAssignments.length > 0;

  return {
    requiresReview,
    status: requiresReview
      ? (chairRequired ? "pending_program_chair" : "pending_qa")
      : "approved",
    assignedProgramChairs: chairAssignments,
    assignedQaOfficers: qaAssignments,
    programChair: {
      status: chairRequired ? "pending" : "not_required",
      reviewedBy: null,
      reviewedAt: null,
      notes: "",
    },
    qaOfficer: {
      status: qaRequired ? "pending" : "not_required",
      reviewedBy: null,
      reviewedAt: null,
      notes: "",
    },
  };
}

function collectTaskAssignmentUserIds(tasks = [], key = "assignedUploaders", out = new Set()) {
  for (const task of tasks || []) {
    const ids = Array.isArray(task?.[key]) ? task[key] : [];
    for (const id of ids) {
      const raw = id?._id?.toString?.() || id?.toString?.();
      if (raw) out.add(raw);
    }
    collectTaskAssignmentUserIds(task.children || [], key, out);
  }
  return out;
}

function collectFolderAssignmentUserIds(folder) {
  const out = new Set();
  if (!folder) return out;
  const groups = [
    folder?.folderAssignments?.uploaders || [],
    folder?.folderAssignments?.programChairs || [],
    folder?.folderAssignments?.qaOfficers || [],
    folder?.folderAssignments?.evaluators || [],
  ];
  for (const group of groups) {
    for (const entry of group || []) {
      const id = entry?._id?.toString?.() || entry?.toString?.();
      if (id) out.add(String(id));
    }
  }
  collectTaskAssignmentUserIds(folder.complianceTasks || [], "assignedUploaders", out);
  collectTaskAssignmentUserIds(folder.complianceTasks || [], "assignedProgramChairs", out);
  collectTaskAssignmentUserIds(folder.complianceTasks || [], "assignedQaOfficers", out);
  return out;
}

async function canUserAccessFolderByAssignment(folderId, userId, role, cache = new Map()) {
  if (!folderId) return true;
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "superadmin") return true;
  if (!userId) return false;

  const key = String(folderId);
  let folder = cache.get(key);
  if (folder === undefined) {
    folder = await Folder.findById(folderId).select(
      "owner parentFolder sharedWith folderAssignments complianceTasks deletedAt"
    );
    cache.set(key, folder || null);
  }
  if (!folder || folder.deletedAt) return false;

  const ownerId = folder.owner?._id?.toString?.() || folder.owner?.toString?.();
  if (ownerId && ownerId === String(userId)) return true;

  const assigned = collectFolderAssignmentUserIds(folder);
  const hasAssignments = assigned.size > 0;
  if (hasAssignments) {
    // Explicit assignment on this folder grants access to this scope directly.
    return assigned.has(String(userId));
  }

  const shared = (folder.sharedWith || []).some((entry) => {
    const id = entry?._id?.toString?.() || entry?.toString?.();
    return id === String(userId);
  });
  if (shared) {
    return true;
  }

  // Inherit access from parent when this node has no explicit assignments/shares.
  if (folder.parentFolder) {
    return canUserAccessFolderByAssignment(folder.parentFolder, userId, role, cache);
  }

  return false;
}

function canUserAccessFolderDirect(folder, userId, role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "superadmin") return true;
  if (!folder || !userId) return false;

  const ownerId = folder.owner?._id?.toString?.() || folder.owner?.toString?.();
  if (ownerId && ownerId === String(userId)) return true;

  const assigned = collectFolderAssignmentUserIds(folder);
  if (assigned.size > 0) {
    return assigned.has(String(userId));
  }

  return (folder.sharedWith || []).some((entry) => {
    const id = entry?._id?.toString?.() || entry?.toString?.();
    return id === String(userId);
  });
}

async function canUserAccessCopcProgram(rootFolder, userId, role) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "superadmin") return true;
  if (!rootFolder || !userId) return false;

  // Program assignment must grant visibility even if the parent COPC root
  // itself is not directly shared with the user.
  if (canUserAccessFolderDirect(rootFolder, userId, normalizedRole)) return true;

  // Fallback: allow if user is assigned inside any descendant scope.
  const descendantIds = await getDescendantFolderIds(rootFolder._id);
  const innerIds = descendantIds
    .map((id) => String(id))
    .filter((id) => id !== String(rootFolder._id));
  if (!innerIds.length) return false;

  const target = String(userId);
  const assignedChild = await Folder.findOne({
    _id: { $in: innerIds },
    deletedAt: null,
    $or: [
      { "folderAssignments.uploaders": target },
      { "folderAssignments.programChairs": target },
      { "folderAssignments.qaOfficers": target },
      { "folderAssignments.evaluators": target },
    ],
  }).select("_id");

  return !!assignedChild;
}

function canUploadToFolder(folder, userId, role) {
  if (!folder || !userId) return false;
  const normalizedRole = normalizeRole(role);
  if (!canUploadDocuments(normalizedRole)) return false;
  if (["superadmin", "qa_admin", "dept_chair"].includes(normalizedRole)) return true;
  const ownerId = folder.owner?._id?.toString?.() || folder.owner?.toString?.();
  if (ownerId === userId?.toString?.()) return true;

  const folderUploaders = new Set(
    (folder.folderAssignments?.uploaders || [])
      .map((id) => id?._id?.toString?.() || id?.toString?.())
      .filter(Boolean)
  );
  const taskUploaders = collectTaskAssignmentUserIds(folder.complianceTasks || [], "assignedUploaders");
  const restrictedByAssignments = folderUploaders.size > 0 || taskUploaders.size > 0;
  const hasComplianceScope =
    !!folder?.complianceProfileKey || Array.isArray(folder?.complianceTasks) && folder.complianceTasks.length > 0;
  if (!restrictedByAssignments && hasComplianceScope) {
    // Compliance folders must be explicitly assigned for non-admin users.
    return false;
  }
  if (!restrictedByAssignments) return true;

  const target = userId?.toString?.();
  return folderUploaders.has(target) || taskUploaders.has(target);
}

function isFileFullyApprovedForCopc(file) {
  const wf = file?.reviewWorkflow || {};
  const chairApproved = String(wf?.programChair?.status || "") === "approved";
  const qaApproved = String(wf?.qaOfficer?.status || "") === "approved";
  const workflowApproved = String(wf?.status || "") === "approved";
  return chairApproved && qaApproved && workflowApproved;
}

function normalizePermissionRole(permission, fallback = "viewer") {
  const value = String(permission || "").toLowerCase();
  if (value === "owner") return "owner";
  if (value === "editor" || value === "write") return "editor";
  if (value === "viewer" || value === "read") return "viewer";
  return fallback;
}

function canRoleEdit(permission) {
  const role = normalizePermissionRole(permission);
  return role === "editor" || role === "owner";
}

const COPC_DEFAULT_STRUCTURE = [
  "01 Program Profile",
  "02 Curriculum",
  "03 Faculty Credentials",
  "04 Facilities",
  "05 Library Resources",
  "06 Administration",
  "07 Supporting Documents",
];

const COPC_DEFAULT_TASKS = {
  "01 Program Profile": ["Program mission and vision", "Program rationale", "Program objectives"],
  "02 Curriculum": ["Curriculum map", "Program outcomes alignment", "Course syllabi and specifications"],
  "03 Faculty Credentials": ["TOR", "Diploma", "PRC License", "Curriculum Vitae", "Training Certificates"],
  "04 Facilities": ["Laboratory inventory", "Lab photos", "Facilities utilization"],
  "05 Library Resources": ["Library holdings", "Digital resources", "Library utilization report"],
  "06 Administration": ["Organizational chart", "Admin policies", "Academic governance records"],
  "07 Supporting Documents": ["MOA/MOU", "Extension programs", "Quality improvement plans"],
};

async function getDescendantFolderIds(rootId, options = {}) {
  const includeDeleted = !!options.includeDeleted;
  const out = [];
  const queue = [String(rootId)];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    const query = includeDeleted
      ? { parentFolder: current }
      : { parentFolder: current, deletedAt: null };
    const children = await Folder.find(query).select("_id");
    for (const child of children) queue.push(String(child._id));
  }
  return out;
}

async function findCopcRootFolderByFolderId(folderId) {
  if (!folderId) return null;
  let current = await Folder.findById(folderId).select("parentFolder copc deletedAt");
  while (current) {
    if (current.deletedAt) return null;
    if (current?.copc?.isProgramRoot) return current;
    if (!current.parentFolder) return null;
    current = await Folder.findById(current.parentFolder).select("parentFolder copc deletedAt");
  }
  return null;
}

async function isFolderWithinLockedCopc(folderId) {
  const root = await findCopcRootFolderByFolderId(folderId);
  return !!(root?.copc?.locked?.isLocked);
}

async function softDeleteFolderTree(folderId, at = new Date()) {
  const ids = await getDescendantFolderIds(folderId, { includeDeleted: true });
  await Folder.updateMany({ _id: { $in: ids } }, { deletedAt: at });
  await File.updateMany({ parentFolder: { $in: ids }, deletedAt: null }, { deletedAt: at });
  return ids;
}

async function restoreFolderTree(folderId) {
  const ids = await getDescendantFolderIds(folderId, { includeDeleted: true });
  await Folder.updateMany({ _id: { $in: ids } }, { deletedAt: null });
  await File.updateMany({ parentFolder: { $in: ids } }, { deletedAt: null });
  return ids;
}

async function updateCopcStage(folderId, nextStage, fallbackStatus = "In Progress") {
  const root = await findCopcRootFolderByFolderId(folderId);
  if (!root || !root?.copc?.isProgramRoot) return;
  if (root?.copc?.locked?.isLocked) return;
  const stageOrder = [
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
  ];
  const current = String(root?.copc?.workflowStage || "initialized");
  const next = String(nextStage || current);
  const currentIndex = stageOrder.indexOf(current);
  const nextIndex = stageOrder.indexOf(next);
  if (nextIndex === -1) return;
  if (next === "revision" || nextIndex >= currentIndex) {
    root.copc.workflowStage = next;
    root.copc.workflowStatus = fallbackStatus || "In Progress";
    await root.save();
  }
}

async function getGroupSharePermissionForFile(userId, fileId) {
  if (!userId || !fileId) return null;
  const groups = await Group.find({
    members: userId,
    "sharedFiles.fileId": fileId,
  }).select("sharedFiles");

  let best = null;
  for (const group of groups) {
    for (const shared of group.sharedFiles || []) {
      if (shared.fileId?.toString?.() !== fileId.toString()) continue;
      const normalized = normalizePermissionRole(shared.permission);
      if (normalized === "editor") return "editor";
      if (!best) best = normalized;
    }
  }
  return best;
}

/* ========================
   MONGODB
======================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("? MongoDB connected");
    createLog("SYSTEM", null, "MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB error:", err);
    createLog("SYSTEM_ERROR", null, `MongoDB connection error: ${err.message || err}`);
  });

mongoose.connection.on("disconnected", () => {
  console.warn("?? MongoDB disconnected");
  createLog("SYSTEM", null, "MongoDB disconnected");
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";

/* ========================
   MULTER
======================== */
// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });
const mimeByExt = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".txt": "text/plain",
  ".json": "application/json",
  ".xml": "application/xml",
  ".csv": "text/csv",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt": "application/vnd.ms-powerpoint",
};
const extByMime = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "text/plain": ".txt",
  "application/json": ".json",
  "application/xml": ".xml",
  "text/csv": ".csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.ms-powerpoint": ".ppt",
};
const getExtension = (name) => path.extname((name || "").toLowerCase());
const ensureExtension = (name, mime) => {
  const trimmed = (name || "file").trim() || "file";
  const ext = getExtension(trimmed);
  if (ext) return trimmed;
  const fallback = extByMime[mime];
  return fallback ? `${trimmed}${fallback}` : trimmed;
};
const getContentType = (name, mime) => {
  const ext = getExtension(name);
  return mime || mimeByExt[ext] || "application/octet-stream";
};

const CLASSIFICATION_VERSION = "v1";
const MAX_CLASSIFICATION_TEXT = 15000;

const normalizeText = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const keywordCategories = [
  {
    category: "Course Material",
    keywords: ["syllabus", "assignment", "lecture", "exam", "quiz", "rubric", "curriculum", "course"],
  },
  {
    category: "Research",
    keywords: ["research", "methodology", "experiment", "journal", "thesis", "dissertation", "hypothesis"],
  },
  {
    category: "Administrative Policy",
    keywords: ["policy", "guideline", "procedure", "handbook", "memorandum", "memo", "directive"],
  },
  {
    category: "Finance",
    keywords: ["invoice", "receipt", "budget", "tuition", "payroll", "reimbursement", "finance"],
  },
  {
    category: "Legal/Compliance",
    keywords: ["agreement", "contract", "consent", "compliance", "privacy", "nda", "terms"],
  },
  {
    category: "Student Record",
    keywords: ["transcript", "attendance", "grades", "enrollment", "student record"],
  },
];

async function extractTextForClassification(filePath, mimetype, originalName) {
  const ext = getExtension(originalName);
  try {
    if (mimetype?.startsWith("text/") || ["application/json", "application/xml"].includes(mimetype) || [".txt", ".json", ".xml", ".csv"].includes(ext)) {
      return fs.readFileSync(filePath, "utf8").slice(0, MAX_CLASSIFICATION_TEXT);
    }

    if (mimetype?.includes("pdf") || ext === ".pdf") {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(fs.readFileSync(filePath));
      return (data?.text || "").slice(0, MAX_CLASSIFICATION_TEXT);
    }

    if (mimetype?.includes("wordprocessingml") || ext === ".docx") {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return (result?.value || "").slice(0, MAX_CLASSIFICATION_TEXT);
    }

    if (mimetype?.includes("spreadsheetml") || mimetype?.includes("vnd.ms-excel") || [".xlsx", ".xls"].includes(ext)) {
      const XLSX = require("xlsx");
      const workbook = XLSX.readFile(filePath, { cellText: true });
      let out = "";
      for (const sheetName of workbook.SheetNames.slice(0, 3)) {
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false });
        for (const row of rows.slice(0, 40)) {
          out += `${row.join(" ")} `;
          if (out.length >= MAX_CLASSIFICATION_TEXT) break;
        }
        if (out.length >= MAX_CLASSIFICATION_TEXT) break;
      }
      return out.slice(0, MAX_CLASSIFICATION_TEXT);
    }
  } catch (err) {
    console.warn("classification text extraction failed:", err?.message || err);
  }
  return "";
}

function classifyDocument({ originalName, mimetype, text }) {
  const ext = getExtension(originalName);
  const normalizedName = normalizeText(originalName);
  const normalizedText = normalizeText(text).slice(0, MAX_CLASSIFICATION_TEXT);
  const haystack = `${normalizedName} ${normalizedText}`;

  if (mimetype?.startsWith("image/")) {
    return { category: "Image Media", confidence: 0.96, tags: ["image", ext.replace(".", "")].filter(Boolean) };
  }
  if (mimetype?.startsWith("video/")) {
    return { category: "Video Media", confidence: 0.96, tags: ["video", ext.replace(".", "")].filter(Boolean) };
  }
  if (mimetype?.startsWith("audio/")) {
    return { category: "Audio Media", confidence: 0.96, tags: ["audio", ext.replace(".", "")].filter(Boolean) };
  }
  if (mimetype?.includes("presentationml") || [".pptx", ".ppt"].includes(ext)) {
    return { category: "Presentation", confidence: 0.9, tags: ["slides", ext.replace(".", "")].filter(Boolean) };
  }

  let best = { category: "General Document", score: 0 };
  const tags = new Set();
  for (const entry of keywordCategories) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (haystack.includes(keyword)) {
        score += 1;
        tags.add(keyword);
      }
    }
    if (score > best.score) {
      best = { category: entry.category, score };
    }
  }

  if (mimetype?.includes("spreadsheetml") || mimetype?.includes("vnd.ms-excel") || [".xlsx", ".xls", ".csv"].includes(ext)) {
    tags.add("tabular");
    if (best.score === 0) best = { category: "Data Sheet", score: 1 };
  }
  if (mimetype?.includes("pdf") || ext === ".pdf") tags.add("pdf");
  if (mimetype?.includes("wordprocessingml") || ext === ".docx") tags.add("document");

  const confidence = Math.min(0.98, 0.55 + best.score * 0.1);
  return {
    category: best.category,
    confidence,
    tags: Array.from(tags).slice(0, 12),
  };
}

async function computeFileHash(filePath) {
  const hash = crypto.createHash("sha256");
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest("hex");
}

async function reconcileDuplicateGroup(contentHash) {
  if (!contentHash) return;
  const group = await File.find({ contentHash, deletedAt: null })
    .sort({ uploadDate: 1, _id: 1 })
    .select("_id");
  if (!group.length) return;

  const canonicalId = group[0]._id;
  if (group.length === 1) {
    await File.findByIdAndUpdate(canonicalId, { duplicateOf: null });
    return;
  }

  await File.updateMany({ _id: { $in: group.map((f) => f._id) } }, { duplicateOf: canonicalId });
  await File.findByIdAndUpdate(canonicalId, { duplicateOf: null });
}

async function userHasFileAccess(file, userId, role) {
  if (!file || !userId) return false;
  if (normalizeRole(role) === "superadmin") return true;

  const ownerId = file.owner?._id?.toString?.() || file.owner?.toString?.() || file.userId?.toString?.() || file.userId;
  if (ownerId?.toString() === userId.toString()) return true;

  const workflow = file.reviewWorkflow || {};
  const assignedProgramChairs = Array.isArray(workflow.assignedProgramChairs)
    ? workflow.assignedProgramChairs
    : [];
  const assignedQaOfficers = Array.isArray(workflow.assignedQaOfficers)
    ? workflow.assignedQaOfficers
    : [];
  if (
    isUserAssignedTo(userId, assignedProgramChairs) ||
    isUserAssignedTo(userId, assignedQaOfficers)
  ) {
    return true;
  }

  // Once fully approved in COPC flow, expose to all users authorized on the COPC program scope.
  if (file.parentFolder && isFileFullyApprovedForCopc(file)) {
    const root = await findCopcRootFolderByFolderId(file.parentFolder);
    if (root && (await canUserAccessCopcProgram(root, userId, role))) {
      return true;
    }
  }

  if (file.parentFolder) {
    const canViewParent = await canUserAccessFolderByAssignment(file.parentFolder, userId, role);
    if (!canViewParent) return false;
  }
  const isDirectShare = !!file.sharedWith?.some((id) => {
    const sharedId = id?.toString ? id.toString() : id;
    return sharedId?.toString() === userId.toString();
  });
  if (isDirectShare) return true;
  const groupPermission = await getGroupSharePermissionForFile(userId, file._id);
  return groupPermission === "viewer" || groupPermission === "editor";
}

function isFlaggedByUser(ids, userId) {
  if (!userId) return false;
  return !!ids?.some((id) => id?.toString?.() === userId.toString());
}

function isEditableDocument(file) {
  if (!file) return false;
  const name = (file.originalName || "").toLowerCase();
  const editableExt = [".txt", ".md", ".json", ".xml", ".csv", ".docx", ".xlsx", ".xls", ".pdf", ".pptx", ".ppt"];
  return (
    file.mimetype?.startsWith("text/") ||
    file.mimetype === "application/json" ||
    file.mimetype === "application/xml" ||
    editableExt.some((ext) => name.endsWith(ext))
  );
}

function getEditableKind(file) {
  const name = (file?.originalName || "").toLowerCase();
  const ext = getExtension(name);
  if (file?.mimetype?.includes("wordprocessingml") || ext === ".docx") return "docx";
  if (file?.mimetype?.includes("spreadsheetml") || file?.mimetype?.includes("vnd.ms-excel") || ext === ".xlsx" || ext === ".xls") return "xlsx";
  if (file?.mimetype?.includes("presentationml") || ext === ".pptx" || ext === ".ppt") return "pptx";
  if (file?.mimetype?.includes("pdf") || ext === ".pdf") return "pdf";
  return "text";
}

async function extractEditableContent(filePath, file) {
  const kind = getEditableKind(file);
  if (kind === "text") {
    return { kind, content: fs.readFileSync(filePath, "utf8") };
  }
  if (kind === "docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
    return { kind, content: result?.value || "" };
  }
  if (kind === "xlsx") {
    const XLSX = require("xlsx");
    const workbook = XLSX.readFile(filePath, { cellText: true });
    const firstSheet = workbook.SheetNames[0];
    const csv = firstSheet ? XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]) : "";
    return { kind, content: csv };
  }
  if (kind === "pdf") {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(fs.readFileSync(filePath));
    return { kind, content: data?.text || "" };
  }
  if (kind === "pptx") {
    try {
      const JSZip = require("jszip");
      const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
      const slideFiles = Object.keys(zip.files)
        .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
        .sort((a, b) => {
          const ai = parseInt((a.match(/\d+/) || ["0"])[0], 10);
          const bi = parseInt((b.match(/\d+/) || ["0"])[0], 10);
          return ai - bi;
        });
      const slides = [];
      for (const filePathInZip of slideFiles) {
        const xml = await zip.file(filePathInZip).async("string");
        const texts = [];
        const regex = /<a:t>([\s\S]*?)<\/a:t>/g;
        let match = regex.exec(xml);
        while (match) {
          const txt = (match[1] || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
          if (txt.trim()) texts.push(txt.trim());
          match = regex.exec(xml);
        }
        if (texts.length) slides.push(texts.join("\n"));
      }
      return {
        kind,
        content: slides.map((s, i) => `# Slide ${i + 1}\n${s}`).join("\n\n"),
      };
    } catch {
      return {
        kind,
        content:
          "# Slide 1\n\nEdit presentation text here.\n\n# Slide 2\n\nAdd more slides using this format.",
      };
    }
  }
  return { kind: "text", content: "" };
}

async function writeEditedContent(filePath, file, content) {
  const kind = getEditableKind(file);
  if (kind === "text") {
    fs.writeFileSync(filePath, content, "utf8");
    return;
  }
  if (kind === "docx") {
    const { Document: DocxDocument, Packer, Paragraph } = require("docx");
    const doc = new DocxDocument({
      sections: [
        {
          children: (content || "").split(/\r?\n/).map((line) => new Paragraph(line || "")),
        },
      ],
    });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);
    return;
  }
  if (kind === "xlsx") {
    const XLSX = require("xlsx");
    const rows = (content || "")
      .split(/\r?\n/)
      .map((line) => line.split(","));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filePath);
    return;
  }
  if (kind === "pdf") {
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    await new Promise((resolve) => {
      doc.on("data", (d) => chunks.push(d));
      doc.on("end", resolve);
      doc.fontSize(11).text(content || "", { width: 520 });
      doc.end();
    });
    fs.writeFileSync(filePath, Buffer.concat(chunks));
    return;
  }
  if (kind === "pptx") {
    const PptxGenJS = require("pptxgenjs");
    const pptx = new PptxGenJS();
    const blocks = (content || "")
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    const slides = blocks.length ? blocks : ["# Slide 1\nEditable presentation content"];
    slides.forEach((block) => {
      const lines = block.split(/\r?\n/);
      const first = lines[0] || "";
      const title = first.replace(/^#\s*/, "").trim() || "Slide";
      const body = lines.slice(1).join("\n").trim();
      const slide = pptx.addSlide();
      slide.addText(title, { x: 0.5, y: 0.3, w: 12.3, h: 0.7, fontSize: 26, bold: true });
      if (body) {
        slide.addText(body, { x: 0.7, y: 1.3, w: 11.8, h: 5.4, fontSize: 16, valign: "top" });
      }
    });
    await pptx.writeFile({ fileName: filePath });
  }
}

function renderTemplateBody(templateBody, payload = {}) {
  return (templateBody || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = payload[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function sanitizeName(name) {
  return (name || "document").replace(/[^\w\- ]+/g, "").trim() || "document";
}

function encodeAccessDetails(action, file) {
  const fileId = file?._id?.toString?.() || "";
  const safeName = (file?.originalName || "").replace(/[|]/g, " ");
  return `FILE_ACCESS|${action}|${fileId}|${safeName}`;
}

function parseAccessDetails(details) {
  const raw = String(details || "");
  const parts = raw.split("|");
  if (parts.length < 4 || parts[0] !== "FILE_ACCESS") return null;
  return {
    action: parts[1] || "",
    fileId: parts[2] || "",
    fileName: parts.slice(3).join("|") || "",
  };
}

function scoreRelevantFile(file, userId) {
  let score = 0;
  if (isFlaggedByUser(file.pinnedBy, userId)) score += 5;
  if (isFlaggedByUser(file.favoritedBy, userId)) score += 4;
  if (!file.duplicateOf) score += 1;
  const uploadedAt = new Date(file.uploadDate || 0).getTime();
  const ageHours = Math.max(1, (Date.now() - uploadedAt) / (1000 * 60 * 60));
  score += Math.max(0, 3 - ageHours / 24);
  return Number(score.toFixed(2));
}

function buildAutoReportContent(data = {}) {
  const safe = (value, fallback = "N/A") => {
    const normalized = value === undefined || value === null ? "" : String(value).trim();
    return normalized || fallback;
  };
  return [
    safe(data.reportTitle, "Document Activity Report"),
    `Period: ${safe(data.period)}`,
    "",
    "Summary",
    safe(data.summary),
    "",
    "Metrics",
    `- Total Documents: ${safe(data.totalDocuments, "0")}`,
    `- New Uploads: ${safe(data.newUploads, "0")}`,
    `- Duplicate Files: ${safe(data.duplicateFiles, "0")}`,
  ].join("\n");
}

async function createGeneratedDocumentBuffer(outputType, content) {
  if (outputType === "txt") {
    return Buffer.from(content || "", "utf8");
  }
  if (outputType === "pdf") {
    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    await new Promise((resolve) => {
      doc.on("data", (d) => chunks.push(d));
      doc.on("end", resolve);
      doc.fontSize(11).text(content || "", { width: 520 });
      doc.end();
    });
    return Buffer.concat(chunks);
  }

  // default DOCX
  const { Document: DocxDocument, Packer, Paragraph } = require("docx");
  const doc = new DocxDocument({
    sections: [
      {
        children: (content || "").split(/\r?\n/).map((line) => new Paragraph(line || "")),
      },
    ],
  });
  return Packer.toBuffer(doc);
}

async function canUserEditFile(file, userId, role) {
  if (!file || !userId) return false;
  const isAdmin = canEditAnyDocuments(role);
  if (isAdmin) return true;

  const ownerId = file.owner?._id?.toString?.() || file.owner?.toString?.() || file.userId?.toString?.() || file.userId;
  const isOwner = ownerId?.toString() === userId.toString();
  const isSharedWithEditor =
    !!file.sharedWith?.some((id) => (id?.toString ? id.toString() : id) === userId) &&
    canRoleEdit(file.permissions);
  const groupPermission = await getGroupSharePermissionForFile(userId, file._id);
  const isGroupEditor = groupPermission === "editor";
  const isLeader = await isGroupLeaderForFile(userId, file._id);

  return isOwner || isSharedWithEditor || isGroupEditor || isLeader;
}

function buildFolderPathMap(folders) {
  const byId = new Map(folders.map((f) => [f._id.toString(), f]));
  const pathCache = new Map();

  const getPathParts = (folderId) => {
    const key = folderId.toString();
    if (pathCache.has(key)) return pathCache.get(key);

    const parts = [];
    let cursor = byId.get(key);
    const guard = new Set();
    while (cursor && !guard.has(cursor._id.toString())) {
      guard.add(cursor._id.toString());
      parts.unshift(cursor.name);
      const parentId = cursor.parentFolder?.toString?.();
      cursor = parentId ? byId.get(parentId) : null;
    }
    pathCache.set(key, parts);
    return parts;
  };

  return { getPathParts };
}

function getDestinationIntent(filename, mimetype, classification) {
  const name = normalizeText(filename);
  const hints = new Set();
  const reasons = [];
  const currentYear = new Date().getFullYear().toString();

  const addHint = (value, reason) => {
    if (!value) return;
    hints.add(value);
    if (reason) reasons.push(reason);
  };

  const hasAny = (words) => words.some((w) => name.includes(w));

  if (hasAny(["contract", "agreement", "nda", "terms"])) {
    ["legal", "clients", currentYear, "contracts"].forEach((h) => addHint(h, "Detected legal contract terms"));
  }
  if (hasAny(["invoice", "budget", "receipt", "payroll", "finance"])) {
    ["finance", currentYear, "invoices"].forEach((h) => addHint(h, "Detected finance terms"));
  }
  if (hasAny(["syllabus", "assignment", "lecture", "quiz", "exam"])) {
    ["course", "materials", currentYear].forEach((h) => addHint(h, "Detected course material terms"));
  }
  if (hasAny(["transcript", "enrollment", "attendance", "grades"])) {
    ["student", "records", currentYear].forEach((h) => addHint(h, "Detected student record terms"));
  }
  if (mimetype?.includes("pdf")) addHint("pdf");

  if (classification?.category) {
    addHint(normalizeText(classification.category), "Used document classification");
    const mapped = {
      "Administrative Policy": ["policy", "administrative"],
      "Course Material": ["course", "materials"],
      "Legal/Compliance": ["legal", "compliance"],
      Finance: ["finance"],
      Research: ["research"],
      "Student Record": ["student", "records"],
    };
    (mapped[classification.category] || []).forEach((h) => addHint(h, "Mapped classification to folder intent"));
  }

  if (hints.size === 0) {
    addHint(currentYear, "Fallback to current year");
  }

  return { hints: Array.from(hints), reasons };
}

function scoreFolderPath(pathParts, hints) {
  if (!pathParts?.length) return 0;
  const parts = pathParts.map((p) => normalizeText(p));
  let score = 0;
  for (const hintRaw of hints) {
    const hint = normalizeText(hintRaw);
    if (!hint) continue;
    const exactHit = parts.some((p) => p === hint);
    const partialHit = parts.some((p) => p.includes(hint) || hint.includes(p));
    if (exactHit) score += 4;
    else if (partialHit) score += 2;
  }

  // Prefer deeper, more specific paths when hints match.
  if (score > 0) score += Math.min(3, parts.length * 0.25);
  return score;
}

/* ========================
   AUTH
======================== */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });

    if (!user) return res.status(404).json({ error: "No record found" });
    if (user.password !== password)
      return res.status(401).json({ error: "Incorrect password" });

    // Check if user is active
    if (user.active === false) {
      return res.status(403).json({ error: "Account is deactivated" });
    }

    // NEW: log login
    try {
      await createLog("LOGIN", user._id, `${email} logged in`);
    } catch (e) {
      console.error("Login log failed:", e);
    }

    // Create a welcome notification for new users (first login)
    const existingNotifications = await Notification.countDocuments({ userId: user._id });
    if (existingNotifications === 0) {
      await createNotification(
        user._id,
        "WELCOME",
        "Welcome to DocuDB!",
        "Welcome to DocuDB! Start by uploading your first file or creating a folder.",
        "Getting started guide",
        null,
        null,
        { actorId: user._id, allowSelf: true }
      );
    }

    res.json({
      status: "success",
      role: normalizeRole(user.role),
      userId: user._id.toString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ========================
   FILES
======================== */
/* ========================
/* ========================
   COMMENTS
======================== */
// Fetch comments with replies for an item
app.get("/comments", async (req, res) => {
  try {
    const { itemId, itemType } = req.query;
    if (!itemId || !itemType) {
      return res.status(400).json({ error: "Missing itemId or itemType" });
    }
    const roots = await Comment.find({
      itemId,
      itemType,
      parentCommentId: null,
    })
      .sort({ createdAt: -1 })
    .populate("createdBy", "email profilePicture")
      .populate({
        path: "replies",
        options: { sort: { createdAt: 1 } },
      populate: { path: "createdBy", select: "email profilePicture" },
      });
    res.json(roots);
  } catch (err) {
    console.error("Fetch comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// Create comment or reply
app.post("/comments", async (req, res) => {
  try {
    const { itemId, itemType, content, createdBy, parentCommentId } = req.body;
    if (!itemId || !itemType || !content || !createdBy) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const comment = await Comment.create({
      itemId,
      itemType,
      content,
      createdBy,
      parentCommentId: parentCommentId || null,
    });
    if (parentCommentId) {
      await Comment.findByIdAndUpdate(parentCommentId, {
        $push: { replies: comment._id },
      });
    }
    await comment.populate("createdBy", "email");

    const itemContext = await getItemNotificationContext(itemId, itemType);
    const parentComment = parentCommentId
      ? await Comment.findById(parentCommentId).select("createdBy")
      : null;
    const recipients = uniqNotificationIds([
      itemContext.ownerId,
      parentComment?.createdBy,
    ]);

    await createNotificationsForUsers(
      recipients,
      "COMMENT",
      parentCommentId ? "New reply received" : "New comment received",
      `${comment.createdBy?.email || "Someone"} commented on "${itemContext.label}".`,
      String(content || "").trim().slice(0, 180),
      itemId,
      itemContext.relatedModel,
      {
        actorId: createdBy,
        metadata: {
          itemType,
          itemLabel: itemContext.label,
        },
      }
    );

    res.json(comment);
  } catch (err) {
    console.error("Create comment error:", err);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// Edit comment
app.patch("/comments/:id", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content required" });
    }
    const updated = await Comment.findByIdAndUpdate(
      req.params.id,
      { content: content.trim() },
      { new: true }
    ).populate("createdBy", "email");
    if (!updated) return res.status(404).json({ error: "Comment not found" });
    res.json(updated);
  } catch (err) {
    console.error("Edit comment error:", err);
    res.status(500).json({ error: "Failed to edit comment" });
  }
});

// Delete comment or reply
app.delete("/comments/:id", async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    if (comment.parentCommentId) {
      // Remove reference from parent replies
      await Comment.findByIdAndUpdate(comment.parentCommentId, {
        $pull: { replies: comment._id },
      });
    } else {
      // If deleting a root comment, also delete its replies
      await Comment.deleteMany({ parentCommentId: comment._id });
    }
    await Comment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});
/* ========================
   PROFILE PICTURE UPLOAD
======================== */
// Upload profile picture
app.post("/upload-profile-picture", upload.single("profilePicture"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // Validate file type (only images)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Only image files are allowed" });
    }

    // Validate file size (max 5MB)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "File size must be less than 5MB" });
    }

    // Update user profile picture
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { profilePicture: req.file.filename },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    // Log the action
    createLog("PROFILE_PICTURE_UPDATE", userId, `Updated profile picture`);

    res.json({ success: true, profilePicture: req.file.filename });
  } catch (err) {
    console.error("Profile picture upload error:", err);
    res.status(500).json({ error: "Profile picture upload failed" });
  }
});

// Update user profile fields (limited: profilePicture)
app.patch("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { profilePicture } = req.body;
    const update = {};
    if (typeof profilePicture !== "undefined") {
      update.profilePicture = profilePicture;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No updatable fields provided" });
    }
    const user = await UserModel.findByIdAndUpdate(id, update, { new: true });
    if (!user) return res.status(404).json({ error: "User not found" });
    createLog("UPDATE_USER_PROFILE", user._id, "Updated profile fields");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

/* ========================
   FILES
======================== */
// Upload file
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { userId, role, parentFolder, isUpdate, fileId, changeDescription } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const actorRole = await resolveActorRole(userId, role);
    if (!canUploadDocuments(actorRole)) {
      return res.status(403).json({ error: "Your role cannot upload documents" });
    }

    let targetFolder = null;
    if (parentFolder) {
      targetFolder = await Folder.findById(parentFolder).select("owner folderAssignments complianceTasks deletedAt");
      if (!targetFolder || targetFolder.deletedAt) {
        return res.status(404).json({ error: "Parent folder not found" });
      }
      if (await isFolderWithinLockedCopc(parentFolder)) {
        return res.status(423).json({ error: "This COPC scope is locked after final approval" });
      }
      if (!canUploadToFolder(targetFolder, userId, actorRole)) {
        return res.status(403).json({ error: "You are not assigned to upload in this folder" });
      }
    }

    let file;
    let versionNumber = 1;
    let previousHash = null;
    const uploadedFilePath = path.join(__dirname, "uploads", req.file.filename);
    const contentHash = await computeFileHash(uploadedFilePath);
    const extractedText = await extractTextForClassification(uploadedFilePath, req.file.mimetype, req.file.originalname);
    const classificationResult = classifyDocument({
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      text: extractedText,
    });

    if (isUpdate && fileId) {
      // Update existing file - create new version
      file = await File.findById(fileId);
      if (!file) return res.status(404).json({ error: "File not found" });
      previousHash = file.contentHash || null;

      if (!targetFolder && file.parentFolder) {
        targetFolder = await Folder.findById(file.parentFolder).select("owner folderAssignments complianceTasks deletedAt");
      }
      if (file.parentFolder && await isFolderWithinLockedCopc(file.parentFolder)) {
        return res.status(423).json({ error: "This COPC scope is locked after final approval" });
      }
      if (targetFolder && !canUploadToFolder(targetFolder, userId, actorRole)) {
        return res.status(403).json({ error: "You are not assigned to upload in this folder" });
      }

      const isOwner =
        file.owner?.toString?.() === userId ||
        file.userId?.toString?.() === userId;
      const isSharedWithEditor =
        file.sharedWith?.some(id => id.toString() === userId) &&
        canRoleEdit(file.permissions);
      const isAdmin = await isAdminContext(role, userId);
      const isLeader = await isGroupLeaderForFile(userId, file._id);
      const groupPermission = await getGroupSharePermissionForFile(userId, file._id);
      const isGroupEditor = groupPermission === "editor";
      if (!isOwner && !isSharedWithEditor && !isGroupEditor && !isLeader && !isAdmin) {
        return res.status(403).json({ error: "Not authorized to update this file" });
      }

      // Get latest version number
      const latestVersion = await FileVersion.findOne({ fileId: file._id })
        .sort({ versionNumber: -1 });
      versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

      // Mark all previous versions as not current
      await FileVersion.updateMany(
        { fileId: file._id },
        { isCurrent: false }
      );

      // Create version record for old file
      const oldVersion = new FileVersion({
        fileId: file._id,
        versionNumber: versionNumber - 1,
        originalName: file.originalName,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        createdBy: file.owner,
        changeDescription: changeDescription || "Previous version",
        isCurrent: false
      });
      await oldVersion.save();

      // Update file with new version
      file.originalName = req.file.originalname;
      file.filename = req.file.filename;
      file.mimetype = req.file.mimetype;
      file.size = req.file.size;
      file.contentHash = contentHash;
      file.classification = {
        category: classificationResult.category,
        confidence: classificationResult.confidence,
        tags: classificationResult.tags,
        classifiedAt: new Date(),
        classifierVersion: CLASSIFICATION_VERSION,
      };
      if (targetFolder) {
        file.reviewWorkflow = buildFileWorkflowFromFolder(targetFolder);
      }
      await file.save();
    } else {
      // New file upload
      file = new File({
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      userId,
      owner: userId,
      parentFolder: parentFolder || null,
      uploadDate: new Date(),
      contentHash,
      classification: {
        category: classificationResult.category,
        confidence: classificationResult.confidence,
        tags: classificationResult.tags,
        classifiedAt: new Date(),
        classifierVersion: CLASSIFICATION_VERSION,
      },
      reviewWorkflow: targetFolder
        ? buildFileWorkflowFromFolder(targetFolder)
        : {
            requiresReview: false,
            status: "approved",
            assignedProgramChairs: [],
            assignedQaOfficers: [],
            programChair: {
              status: "not_required",
              reviewedBy: null,
              reviewedAt: null,
              notes: "",
            },
            qaOfficer: {
              status: "not_required",
              reviewedBy: null,
              reviewedAt: null,
              notes: "",
            },
          },
    });
    await file.save();
    }

    if (previousHash && previousHash !== contentHash) {
      await reconcileDuplicateGroup(previousHash);
    }
    await reconcileDuplicateGroup(contentHash);

    // Create version record for current file
    const fileVersion = new FileVersion({
      fileId: file._id,
      versionNumber,
      originalName: file.originalName,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      createdBy: userId,
      changeDescription: changeDescription || (isUpdate ? "File updated" : "Initial upload"),
      isCurrent: true
    });
    await fileVersion.save();

    // NEW: log upload
    createLog("UPLOAD", userId, `Uploaded ${req.file.originalname}`);
    if (file?.parentFolder) {
      await updateCopcStage(file.parentFolder, "collecting_documents", "Collecting Documents");
    }

    if (isUpdate && normalizeNotificationId(file.owner) !== normalizeNotificationId(userId)) {
      await createNotification(
        file.owner,
        "FILE_UPDATED",
        "Shared file updated",
        `${req.file.originalname} was updated by another user.`,
        changeDescription || "The document content was updated.",
        file._id,
        "File",
        {
          actorId: userId,
          metadata: {
            fileName: req.file.originalname,
          },
        }
      );
    }

    if (file.reviewWorkflow?.requiresReview) {
      const pendingProgramChair = String(file.reviewWorkflow?.status || "") === "pending_program_chair";
      const pendingQa = String(file.reviewWorkflow?.status || "") === "pending_qa";
      const reviewTargets = pendingProgramChair
        ? file.reviewWorkflow.assignedProgramChairs || []
        : pendingQa
          ? file.reviewWorkflow.assignedQaOfficers || []
          : [];
      const reviewStageLabel = pendingProgramChair ? "department chair" : pendingQa ? "QA" : "review";

      if (reviewTargets.length > 0) {
        await createNotificationsForUsers(
          reviewTargets,
          "REVIEW_REQUIRED",
          "Document ready for review",
          `"${req.file.originalname}" is now ready for ${reviewStageLabel} review.`,
          isUpdate ? "An existing document was updated." : "A new document was uploaded.",
          file._id,
          "File",
          {
            actorId: userId,
            metadata: {
              fileName: req.file.originalname,
              stage: reviewStageLabel,
            },
          }
        );
      }
    }

    const duplicateCount = await File.countDocuments({
      contentHash,
      deletedAt: null,
    });
    const duplicateStatus = duplicateCount > 1 ? "duplicate" : "unique";

    res.json({
      success: true,
      file,
      version: fileVersion,
      classification: file.classification,
      duplicate: {
        status: duplicateStatus,
        count: duplicateCount,
        duplicateOf: file.duplicateOf || null,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// Predict destination folder for an incoming document
app.post("/files/predict-destination", async (req, res) => {
  try {
    const { userId, role, filename, mimetype, classification } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const actorRole = await resolveActorRole(userId, role);

    let folders = [];
    if (hasGlobalViewAccess(actorRole)) {
      folders = await Folder.find({ deletedAt: null }).select("_id name parentFolder createdAt");
    } else {
      const owned = await Folder.find({ owner: userId, deletedAt: null }).select("_id name parentFolder createdAt");
      const shared = await Folder.find({ sharedWith: userId, deletedAt: null }).select("_id name parentFolder createdAt");
      const seen = new Set();
      folders = [...owned, ...shared].filter((f) => {
        const key = f._id.toString();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (!folders.length) {
      return res.json({
        suggestedFolderId: null,
        suggestedPath: "Root",
        confidence: 0,
        hints: [],
        reasons: ["No folders available yet"],
        alternatives: [],
      });
    }

    const { hints, reasons } = getDestinationIntent(
      filename || "Untitled",
      mimetype || "",
      classification || null
    );

    const { getPathParts } = buildFolderPathMap(folders);
    const ranked = folders
      .map((folder) => {
        const pathParts = getPathParts(folder._id);
        const score = scoreFolderPath(pathParts, hints);
        return {
          folderId: folder._id,
          pathParts,
          path: pathParts.join(" > "),
          score,
        };
      })
      .sort((a, b) => b.score - a.score);

    const top = ranked[0];
    const topScore = top?.score || 0;
    const confidence = Math.max(0, Math.min(0.99, topScore / 14));
    const alternatives = ranked
      .filter((r) => r.score > 0)
      .slice(0, 3)
      .map((r) => ({
        folderId: r.folderId,
        path: r.path,
        score: Number(r.score.toFixed(2)),
      }));

    res.json({
      suggestedFolderId: topScore > 0 ? top.folderId : null,
      suggestedPath: topScore > 0 ? top.path : "Root",
      confidence: Number(confidence.toFixed(2)),
      hints,
      reasons,
      alternatives,
    });
  } catch (err) {
    console.error("Predict destination error:", err);
    res.status(500).json({ error: "Failed to predict destination" });
  }
});

/* ========================
   SMART FORM BUILDER
======================== */
app.get("/form-templates", async (req, res) => {
  try {
    const { userId, role } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = hasGlobalViewAccess(actorRole);
    const query = isAdmin ? {} : { owner: userId };
    const templates = await FormTemplate.find(query)
      .populate("destinationFolder", "name parentFolder")
      .sort({ updatedAt: -1 });
    res.json(templates);
  } catch (err) {
    console.error("List templates error:", err);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

app.post("/form-templates", async (req, res) => {
  try {
    const { userId, role, name, description, fields, templateBody, outputType, destinationFolder } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (!name || !templateBody) return res.status(400).json({ error: "Missing required template fields" });

    const ownerUser = await UserModel.findById(userId);
    if (!ownerUser) return res.status(404).json({ error: "User not found" });

    const template = await FormTemplate.create({
      owner: userId,
      name,
      description: description || "",
      fields: Array.isArray(fields) ? fields : [],
      templateBody,
      outputType: ["txt", "docx", "pdf"].includes(outputType) ? outputType : "docx",
      destinationFolder: destinationFolder || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    createLog("CREATE_FORM_TEMPLATE", userId, `Created template "${name}"`);
    res.json({ success: true, template });
  } catch (err) {
    console.error("Create template error:", err);
    res.status(500).json({ error: "Failed to create template" });
  }
});

app.delete("/form-templates/:id", async (req, res) => {
  try {
    const { userId, role } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const template = await FormTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });

    const isAdmin = canEditAnyDocuments(role);
    if (!isAdmin && template.owner.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to delete template" });
    }

    await FormTemplate.findByIdAndDelete(template._id);
    createLog("DELETE_FORM_TEMPLATE", userId, `Deleted template "${template.name}"`);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete template error:", err);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

app.post("/form-templates/:id/generate", async (req, res) => {
  try {
    const { userId, role, values, destinationFolder } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const template = await FormTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });

    const isAdmin = canEditAnyDocuments(role);
    if (!isAdmin && template.owner.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to use this template" });
    }

    const payload = values && typeof values === "object" ? values : {};
    for (const field of template.fields || []) {
      if (field.required && !payload[field.key]) {
        return res.status(400).json({ error: `Missing required field: ${field.label || field.key}` });
      }
    }

    const rendered = renderTemplateBody(template.templateBody, payload);
    const outputType = template.outputType || "docx";
    const ext = outputType === "pdf" ? ".pdf" : outputType === "txt" ? ".txt" : ".docx";
    const mime =
      outputType === "pdf"
        ? "application/pdf"
        : outputType === "txt"
          ? "text/plain"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const buffer = await createGeneratedDocumentBuffer(outputType, rendered);
    const generatedName = `${sanitizeName(template.name)}_${Date.now()}${ext}`;
    const storedFilename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const targetPath = path.join(__dirname, "uploads", storedFilename);
    fs.writeFileSync(targetPath, buffer);

    const targetFolder = destinationFolder || template.destinationFolder || null;
    const contentHash = await computeFileHash(targetPath);
    const extractedText = await extractTextForClassification(targetPath, mime, generatedName);
    const classificationResult = classifyDocument({
      originalName: generatedName,
      mimetype: mime,
      text: extractedText,
    });

    const file = await File.create({
      originalName: generatedName,
      filename: storedFilename,
      mimetype: mime,
      size: buffer.length,
      userId,
      owner: userId,
      parentFolder: targetFolder,
      uploadDate: new Date(),
      contentHash,
      classification: {
        category: classificationResult.category,
        confidence: classificationResult.confidence,
        tags: classificationResult.tags,
        classifiedAt: new Date(),
        classifierVersion: CLASSIFICATION_VERSION,
      },
    });

    await reconcileDuplicateGroup(contentHash);

    const version = await FileVersion.create({
      fileId: file._id,
      versionNumber: 1,
      originalName: file.originalName,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      createdBy: userId,
      changeDescription: `Generated from template "${template.name}"`,
      isCurrent: true,
    });

    createLog("GENERATE_TEMPLATE_DOCUMENT", userId, `Generated "${file.originalName}" from template "${template.name}"`);
    res.json({ success: true, file, version });
  } catch (err) {
    console.error("Generate template document error:", err);
    res.status(500).json({ error: "Failed to generate document from template" });
  }
});

app.post("/reports/auto-generate", async (req, res) => {
  try {
    const { userId, role, reportData } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const actorRole = await resolveActorRole(userId, role);
    if (!canGenerateReports(actorRole)) {
      return res.status(403).json({ error: "Your role cannot generate reports" });
    }

    const outputType = ["txt", "docx", "pdf"].includes(reportData?.outputType)
      ? reportData.outputType
      : "docx";
    const content = buildAutoReportContent(reportData || {});
    const ext = outputType === "pdf" ? ".pdf" : outputType === "txt" ? ".txt" : ".docx";
    const mime =
      outputType === "pdf"
        ? "application/pdf"
        : outputType === "txt"
          ? "text/plain"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const buffer = await createGeneratedDocumentBuffer(outputType, content);
    const reportName = `${sanitizeName(reportData?.reportTitle || "Auto Report")}_${Date.now()}${ext}`;
    const storedFilename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const targetPath = path.join(__dirname, "uploads", storedFilename);
    fs.writeFileSync(targetPath, buffer);

    const targetFolder = reportData?.destinationFolder || null;
    const contentHash = await computeFileHash(targetPath);
    const extractedText = await extractTextForClassification(targetPath, mime, reportName);
    const classificationResult = classifyDocument({
      originalName: reportName,
      mimetype: mime,
      text: extractedText,
    });

    const file = await File.create({
      originalName: reportName,
      filename: storedFilename,
      mimetype: mime,
      size: buffer.length,
      userId,
      owner: userId,
      parentFolder: targetFolder,
      uploadDate: new Date(),
      contentHash,
      classification: {
        category: classificationResult.category,
        confidence: classificationResult.confidence,
        tags: classificationResult.tags,
        classifiedAt: new Date(),
        classifierVersion: CLASSIFICATION_VERSION,
      },
    });

    await reconcileDuplicateGroup(contentHash);

    const version = await FileVersion.create({
      fileId: file._id,
      versionNumber: 1,
      originalName: file.originalName,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      createdBy: userId,
      changeDescription: "Auto-generated report",
      isCurrent: true,
    });

    createLog("AUTO_GENERATE_REPORT", userId, `Generated report "${file.originalName}"`);
    res.json({ success: true, file, version });
  } catch (err) {
    console.error("Auto-generate report error:", err);
    res.status(500).json({ error: "Failed to auto-generate report" });
  }
});

// Get file versions
app.get("/files/:id/versions", async (req, res) => {
  try {
    const versions = await FileVersion.find({ fileId: req.params.id })
      .populate("createdBy", "email")
      .sort({ versionNumber: -1 });
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch file versions" });
  }
});

app.patch("/files/:id/favorite", async (req, res) => {
  try {
    const { userId, role, favorited } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const file = await File.findById(req.params.id).populate("owner");
    if (!file) return res.status(404).json({ error: "File not found" });
    if (!(await userHasFileAccess(file, userId, role))) {
      return res.status(403).json({ error: "Not authorized to bookmark this file" });
    }

    const favorites = new Set((file.favoritedBy || []).map((id) => id.toString()));
    const shouldFavorite = typeof favorited === "boolean" ? favorited : !favorites.has(userId);
    if (shouldFavorite) favorites.add(userId);
    else favorites.delete(userId);

    file.favoritedBy = Array.from(favorites);
    await file.save();
    createLog("BOOKMARK_FAVORITE", userId, `${shouldFavorite ? "Favorited" : "Unfavorited"} ${file.originalName}`);

    res.json({ success: true, isFavorite: shouldFavorite });
  } catch (err) {
    console.error("Favorite toggle error:", err);
    res.status(500).json({ error: "Failed to update favorite status" });
  }
});

app.patch("/files/:id/pin", async (req, res) => {
  try {
    const { userId, role, pinned } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const file = await File.findById(req.params.id).populate("owner");
    if (!file) return res.status(404).json({ error: "File not found" });
    if (!(await userHasFileAccess(file, userId, role))) {
      return res.status(403).json({ error: "Not authorized to pin this file" });
    }

    const pinnedSet = new Set((file.pinnedBy || []).map((id) => id.toString()));
    const shouldPin = typeof pinned === "boolean" ? pinned : !pinnedSet.has(userId);
    if (shouldPin) pinnedSet.add(userId);
    else pinnedSet.delete(userId);

    file.pinnedBy = Array.from(pinnedSet);
    await file.save();
    createLog("BOOKMARK_PIN", userId, `${shouldPin ? "Pinned" : "Unpinned"} ${file.originalName}`);

    res.json({ success: true, isPinned: shouldPin });
  } catch (err) {
    console.error("Pin toggle error:", err);
    res.status(500).json({ error: "Failed to update pinned status" });
  }
});

// Duplicate groups by content hash
app.get("/files/duplicates", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = hasGlobalViewAccess(actorRole);

    const match = { deletedAt: null, contentHash: { $ne: null } };
    if (!isAdmin) {
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      match.$or = [{ userId }, { sharedWith: userId }];
    }

    const groups = await File.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$contentHash",
          count: { $sum: 1 },
          fileIds: { $push: "$_id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 100 },
    ]);

    const allIds = groups.flatMap((g) => g.fileIds);
    const files = await File.find({ _id: { $in: allIds } })
      .populate("owner", "email")
      .select("originalName filename size uploadDate owner userId contentHash duplicateOf classification");
    const fileMap = new Map(files.map((f) => [f._id.toString(), f]));

    const formatted = groups.map((group) => ({
      contentHash: group._id,
      count: group.count,
      files: group.fileIds
        .map((id) => fileMap.get(id.toString()))
        .filter(Boolean)
        .map((f) => ({
          _id: f._id,
          originalName: f.originalName,
          size: f.size,
          uploadDate: f.uploadDate,
          ownerEmail: f.owner?.email || null,
          duplicateOf: f.duplicateOf || null,
          classification: f.classification || null,
        })),
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Duplicate fetch error:", err);
    res.status(500).json({ error: "Failed to fetch duplicate groups" });
  }
});

// Reclassify a single file
app.post("/files/:id/reclassify", async (req, res) => {
  try {
    const { userId, role } = req.body || {};
    const isAdmin = canEditAnyDocuments(role);
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (!isAdmin && file.userId !== userId) {
      return res.status(403).json({ error: "Not authorized to reclassify this file" });
    }

    const filePath = path.join(__dirname, "uploads", file.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on disk" });

    const contentHash = await computeFileHash(filePath);
    const extractedText = await extractTextForClassification(filePath, file.mimetype, file.originalName);
    const classificationResult = classifyDocument({
      originalName: file.originalName,
      mimetype: file.mimetype,
      text: extractedText,
    });

    const previousHash = file.contentHash || null;
    file.contentHash = contentHash;
    file.classification = {
      category: classificationResult.category,
      confidence: classificationResult.confidence,
      tags: classificationResult.tags,
      classifiedAt: new Date(),
      classifierVersion: CLASSIFICATION_VERSION,
    };
    await file.save();

    if (previousHash && previousHash !== contentHash) {
      await reconcileDuplicateGroup(previousHash);
    }
    await reconcileDuplicateGroup(contentHash);

    createLog("RECLASSIFY_FILE", userId || file.owner, `Reclassified ${file.originalName}`);
    res.json({ success: true, file });
  } catch (err) {
    console.error("Reclassify error:", err);
    res.status(500).json({ error: "Failed to reclassify file" });
  }
});

// Reclassify all files for a user (or whole system for admin)
app.post("/files/reclassify-bulk", async (req, res) => {
  try {
    const { userId, role } = req.body || {};
    const isAdmin = canEditAnyDocuments(role);
    if (!isAdmin && !userId) return res.status(400).json({ error: "Missing userId" });

    const query = isAdmin ? { deletedAt: null } : { userId, deletedAt: null };
    const files = await File.find(query).select("_id filename mimetype originalName contentHash");

    let processed = 0;
    for (const file of files) {
      const filePath = path.join(__dirname, "uploads", file.filename);
      if (!fs.existsSync(filePath)) continue;
      const contentHash = await computeFileHash(filePath);
      const extractedText = await extractTextForClassification(filePath, file.mimetype, file.originalName);
      const classificationResult = classifyDocument({
        originalName: file.originalName,
        mimetype: file.mimetype,
        text: extractedText,
      });

      const previousHash = file.contentHash || null;
      file.contentHash = contentHash;
      file.classification = {
        category: classificationResult.category,
        confidence: classificationResult.confidence,
        tags: classificationResult.tags,
        classifiedAt: new Date(),
        classifierVersion: CLASSIFICATION_VERSION,
      };
      await file.save();
      if (previousHash && previousHash !== contentHash) {
        await reconcileDuplicateGroup(previousHash);
      }
      await reconcileDuplicateGroup(contentHash);
      processed += 1;
    }

    createLog("RECLASSIFY_BULK", userId || null, `Reclassified ${processed} file(s)`);
    res.json({ success: true, processed });
  } catch (err) {
    console.error("Bulk reclassify error:", err);
    res.status(500).json({ error: "Failed to reclassify files" });
  }
});

// Preview metadata for richer in-app preview (PDF pages + annotation hints)
app.get("/files/:id/preview-metadata", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const doc = await File.findById(req.params.id).populate("owner");
    if (!doc) return res.status(404).json({ error: "File not found" });

    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = hasGlobalViewAccess(actorRole);
    if (!isAdmin && !(await userHasFileAccess(doc, userId, actorRole))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const ext = (doc.originalName || "").toLowerCase();
    const isPdf = doc.mimetype?.includes("pdf") || ext.endsWith(".pdf");
    let pageCount = 1;

    if (isPdf) {
      const filePath = path.join(__dirname, "uploads", doc.filename);
      if (fs.existsSync(filePath)) {
        try {
          const pdfParse = require("pdf-parse");
          const data = await pdfParse(fs.readFileSync(filePath));
          pageCount = Number.isFinite(data?.numpages) ? data.numpages : 1;
        } catch (e) {
          pageCount = 1;
        }
      }
    }

    const rootComments = await Comment.find({
      itemId: doc._id,
      itemType: "file",
      parentCommentId: null,
    })
      .populate("createdBy", "email")
      .populate({
        path: "replies",
        options: { sort: { createdAt: 1 } },
        populate: { path: "createdBy", select: "email" },
      })
      .sort({ createdAt: -1 });

    const allComments = rootComments.flatMap((c) => [c, ...(c.replies || [])]);

    const extractPage = (content) => {
      if (!content) return null;
      const patterns = [
        /(?:\bpage\b|\bp\b)\s*[:#-]?\s*(\d{1,4})/i,
        /\[(\d{1,4})\]/,
      ];
      for (const p of patterns) {
        const m = content.match(p);
        if (m && m[1]) {
          const value = parseInt(m[1], 10);
          if (Number.isFinite(value) && value > 0) return value;
        }
      }
      return null;
    };

    const extractQuotedTerms = (content) => {
      if (!content) return [];
      const out = [];
      const regex = /"([^"]{2,80})"/g;
      let match = regex.exec(content);
      while (match) {
        const term = (match[1] || "").trim();
        if (term) out.push(term);
        match = regex.exec(content);
      }
      return out;
    };

    const annotations = allComments
      .map((comment) => {
        const pageNumber = extractPage(comment.content);
        return {
          id: comment._id,
          author: comment.createdBy?.email || "Unknown",
          createdAt: comment.createdAt,
          content: comment.content || "",
          pageNumber: pageNumber || null,
        };
      })
      .filter((a) => !!a.content);

    const annotationTerms = [...new Set(
      allComments.flatMap((c) => extractQuotedTerms(c.content))
    )].slice(0, 20);

    res.json({
      fileId: doc._id,
      isPdf,
      pageCount,
      annotations,
      annotationTerms,
    });
  } catch (err) {
    console.error("preview-metadata error:", err);
    res.status(500).json({ error: "Failed to fetch preview metadata" });
  }
});
// Restore file to a specific version (creates a new version)
app.post("/files/:id/versions/:versionId/restore", async (req, res) => {
  try {
    const { userId, role } = req.body || {};
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const isAdmin = canEditAnyDocuments(role);
    const ownerId = file.owner?.toString?.() || file.userId?.toString?.() || file.owner;
    if (!isAdmin && (!userId || ownerId.toString() !== userId.toString())) {
      return res.status(403).json({ error: "Not authorized to restore versions" });
    }

    const version = await FileVersion.findById(req.params.versionId);
    if (!version || version.fileId.toString() !== file._id.toString()) {
      return res.status(404).json({ error: "Version not found" });
    }

    const filePath = path.join(__dirname, "uploads", version.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Version file missing on disk" });
    }

    const latestVersion = await FileVersion.findOne({ fileId: file._id })
      .sort({ versionNumber: -1 });
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await FileVersion.updateMany({ fileId: file._id }, { isCurrent: false });

    file.originalName = version.originalName;
    file.filename = version.filename;
    file.mimetype = version.mimetype;
    file.size = version.size;
    await file.save();

    const restoredVersion = await FileVersion.create({
      fileId: file._id,
      versionNumber: nextVersionNumber,
      originalName: version.originalName,
      filename: version.filename,
      mimetype: version.mimetype,
      size: version.size,
      createdBy: userId || file.owner,
      changeDescription: `Restored to version ${version.versionNumber}`,
      isCurrent: true
    });

    createLog("RESTORE_FILE_VERSION", userId || file.owner, `Restored ${file.originalName} to version ${version.versionNumber}`);

    res.json({ success: true, file, version: restoredVersion });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore file version" });
  }
});

app.post("/upload-camera", upload.array("images", 20), async (req, res) => {
  try {
    const hasMultiple = Array.isArray(req.files) && req.files.length > 0;
    const single = req.file;
    if (!hasMultiple && !single) return res.status(400).json({ error: "No image captured" });
    const { userId, parentFolder, desiredType, originalName, role } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const actorRole = await resolveActorRole(userId, role);
    if (!canUploadDocuments(actorRole)) {
      return res.status(403).json({ error: "Your role cannot upload documents" });
    }
    let targetFolder = null;
    if (parentFolder) {
      targetFolder = await Folder.findById(parentFolder).select("owner folderAssignments complianceTasks deletedAt");
      if (!targetFolder || targetFolder.deletedAt) {
        return res.status(404).json({ error: "Parent folder not found" });
      }
      if (await isFolderWithinLockedCopc(parentFolder)) {
        return res.status(423).json({ error: "This COPC scope is locked after final approval" });
      }
      if (!canUploadToFolder(targetFolder, userId, actorRole)) {
        return res.status(403).json({ error: "You are not assigned to upload in this folder" });
      }
    }
    const type = (desiredType || "pdf").toLowerCase();
    const imageFiles = hasMultiple ? req.files : [single];
    const imageBuffers = imageFiles.map(f => fs.readFileSync(path.join(__dirname, "uploads", f.filename)));

    let targetExt = ".pdf";
    let targetMime = "application/pdf";
    let outBuffer = null;

    if (type === "pdf") {
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({ autoFirstPage: false });
      const chunks = [];
      doc.on("data", d => chunks.push(d));
      doc.on("end", async () => {
        outBuffer = Buffer.concat(chunks);
        await finalize(outBuffer, ".pdf", "application/pdf");
      });
      for (const buf of imageBuffers) {
        const img = doc.openImage(buf);
        doc.addPage({ size: [img.width, img.height] });
        doc.image(img, 0, 0);
      }
      doc.end();
      return;
    } else if (type === "docx" || type === "word") {
      targetExt = ".docx";
      targetMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const { Document: DocxDocument, Packer, Paragraph, Media } = require("docx");
      const d = new DocxDocument();
      const children = [];
      for (const buf of imageBuffers) {
        const image = Media.addImage(d, buf);
        children.push(new Paragraph(image));
      }
      d.addSection({ children });
      outBuffer = await Packer.toBuffer(d);
      await finalize(outBuffer, targetExt, targetMime);
      return;
    } else if (type === "pptx" || type === "ppt") {
      targetExt = ".pptx";
      targetMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      const PptxGenJS = require("pptxgenjs");
      const pptx = new PptxGenJS();
      for (const buf of imageBuffers) {
        const slide = pptx.addSlide();
        const base64 = `data:image/png;base64,${buf.toString("base64")}`;
        slide.addImage({ data: base64, x: 0.5, y: 0.5, w: 9, h: 6.75 });
      }
      outBuffer = await pptx.write("nodebuffer");
      await finalize(outBuffer, targetExt, targetMime);
      return;
    } else if (type === "xlsx" || type === "excel" || type === "xls") {
      targetExt = ".xlsx";
      targetMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const ExcelJS = require("exceljs");
      const wb = new ExcelJS.Workbook();
      let idx = 1;
      for (const buf of imageBuffers) {
        const ws = wb.addWorksheet(`Image ${idx++}`);
        const imgId = wb.addImage({ buffer: buf, extension: "png" });
        ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 800, height: 600 } });
      }
      outBuffer = await wb.xlsx.writeBuffer();
      await finalize(outBuffer, targetExt, targetMime);
      return;
    } else {
      if (imageBuffers.length === 1) {
        const theFile = imageFiles[0];
        const ext = path.extname(theFile.originalname || theFile.filename) || ".png";
        const mime = theFile.mimetype || "image/png";
        await finalize(imageBuffers[0], ext, mime);
      } else {
        const PDFDocument = require("pdfkit");
        const doc = new PDFDocument({ autoFirstPage: false });
        const chunks = [];
        doc.on("data", d => chunks.push(d));
        doc.on("end", async () => {
          outBuffer = Buffer.concat(chunks);
          await finalize(outBuffer, ".pdf", "application/pdf");
        });
        for (const buf of imageBuffers) {
          const img = doc.openImage(buf);
          doc.addPage({ size: [img.width, img.height] });
          doc.image(img, 0, 0);
        }
        doc.end();
      }
      return;
    }

    async function finalize(buffer, ext, mime) {
      let baseName = (originalName || `CameraCapture_${Date.now()}`).replace(/[^\w\-.]/g, "_");
      const hasExt = baseName.toLowerCase().endsWith(ext.toLowerCase());
      const safeName = hasExt ? baseName : `${baseName}${ext}`;
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
      const targetPath = path.join(__dirname, "uploads", filename);
      fs.writeFileSync(targetPath, buffer);

      const file = new File({
        originalName: safeName,
        filename,
        mimetype: mime,
        size: buffer.length,
        userId,
        owner: userId,
        parentFolder: parentFolder || null,
        uploadDate: new Date(),
      });
      const contentHash = await computeFileHash(targetPath);
      const extractedText = await extractTextForClassification(targetPath, mime, safeName);
      const classificationResult = classifyDocument({
        originalName: safeName,
        mimetype: mime,
        text: extractedText,
      });
      file.contentHash = contentHash;
      file.classification = {
        category: classificationResult.category,
        confidence: classificationResult.confidence,
        tags: classificationResult.tags,
        classifiedAt: new Date(),
        classifierVersion: CLASSIFICATION_VERSION,
      };
      file.reviewWorkflow = targetFolder
        ? buildFileWorkflowFromFolder(targetFolder)
        : {
            requiresReview: false,
            status: "approved",
            assignedProgramChairs: [],
            assignedQaOfficers: [],
            programChair: { status: "not_required", reviewedBy: null, reviewedAt: null, notes: "" },
            qaOfficer: { status: "not_required", reviewedBy: null, reviewedAt: null, notes: "" },
          };
      await file.save();
      await reconcileDuplicateGroup(contentHash);

      const version = await FileVersion.create({
        fileId: file._id,
        versionNumber: 1,
        originalName: file.originalName,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        createdBy: userId,
        changeDescription: "Camera capture upload",
        isCurrent: true,
      });

      createLog("UPLOAD", userId, `Camera upload ${file.originalName}`);
      try {
        for (const f of imageFiles) {
          fs.unlinkSync(path.join(__dirname, "uploads", f.filename));
        }
      } catch {}
      const duplicateCount = await File.countDocuments({ contentHash, deletedAt: null });
      return res.json({
        success: true,
        file,
        version,
        classification: file.classification,
        duplicate: {
          status: duplicateCount > 1 ? "duplicate" : "unique",
          count: duplicateCount,
          duplicateOf: file.duplicateOf || null,
        },
      });
    }
  } catch (err) {
    console.error("Upload camera error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});
// List files
app.get("/files", async (req, res) => {
  try {
    const { userId, role, parentFolder, sortBy, sortOrder } = req.query;
    let query = { deletedAt: null }; // exclude trashed files
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = hasGlobalViewAccess(actorRole);

    // Sorting
    let sortOptions = {};
    if (sortBy === "name") {
      sortOptions.originalName = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "date") {
      sortOptions.uploadDate = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "size") {
      sortOptions.size = sortOrder === "desc" ? -1 : 1;
    } else {
      sortOptions.uploadDate = -1; // default: newest first
    }

    let files = [];

    if (isAdmin) {
      // Admins see all files
      query = { deletedAt: null };
      if (parentFolder !== undefined) {
        query.parentFolder = parentFolder === "" ? null : parentFolder;
      }

      files = await File.find(query)
        .populate("owner", "email")
        .sort(sortOptions);
    } else {
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const scopedParent = parentFolder === "" ? null : parentFolder;
      files = await File.find({
        deletedAt: null,
        ...(parentFolder !== undefined && { parentFolder: scopedParent }),
      })
        .populate("owner", "email")
        .sort(sortOptions);
    }

    // Filter out files whose parent folders are deleted
    if (files.length > 0) {
      const parentFolderIds = files
        .map(f => f.parentFolder)
        .filter(id => id !== null && id !== undefined);

      if (parentFolderIds.length > 0) {
        // Get all parent folders that are not deleted
        const existingFolders = await Folder.find({
          _id: { $in: parentFolderIds },
          deletedAt: null
        }).select('_id');

        const existingFolderIds = new Set(existingFolders.map(f => f._id.toString()));

        // Filter files to only include those with no parent folder or parent folder that exists and is not deleted
        files = files.filter(file => {
          const parentId = file.parentFolder?.toString();
          return !parentId || existingFolderIds.has(parentId);
        });
      }
    }

    // Remove duplicates
    const seenIds = new Set();
    const uniqueFiles = files.filter(file => {
      if (seenIds.has(file._id.toString())) return false;
      seenIds.add(file._id.toString());
      return true;
    });

    let visibleFiles = uniqueFiles;
    if (!isAdmin) {
      const scopedFiles = [];
      for (const file of uniqueFiles) {
        if (await userHasFileAccess(file, userId, actorRole)) scopedFiles.push(file);
      }
      visibleFiles = scopedFiles;
    }

    // Add permission info for shared files
    const filesWithPermissions = visibleFiles.map(file => {
      const isOwner = file.owner._id.toString() === userId;
      const isFavorite = isFlaggedByUser(file.favoritedBy, userId);
      const isPinned = isFlaggedByUser(file.pinnedBy, userId);
      return {
        ...file.toObject(),
        isShared: !isOwner,
        permission: isOwner ? "owner" : normalizePermissionRole(file.permissions, "viewer"),
        ownerEmail: file.owner?.email || null,
        isDuplicate: !!file.duplicateOf,
        classification: file.classification || null,
        isFavorite,
        isPinned,
      };
    });

    res.json(filesWithPermissions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// Mark file access events for personalized recent files and activity timeline
app.post("/files/:id/access", async (req, res) => {
  try {
    const { userId, role, action } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const file = await File.findById(req.params.id).populate("owner");
    if (!file) return res.status(404).json({ error: "File not found" });
    if (!(await userHasFileAccess(file, userId, role))) {
      return res.status(403).json({ error: "Not authorized to access this file" });
    }

    const normalizedAction = String(action || "OPEN").toUpperCase();
    file.lastAccessedAt = new Date();
    await file.save();

    createLog("ACCESS_FILE", userId, encodeAccessDetails(normalizedAction, file));
    res.json({ success: true });
  } catch (err) {
    console.error("Track access error:", err);
    res.status(500).json({ error: "Failed to track access" });
  }
});

// Personalized dashboard data for the current user
app.get("/dashboard/personalized/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = hasGlobalViewAccess(actorRole);

    const baseQuery = isAdmin
      ? { deletedAt: null }
      : {
          deletedAt: null,
          $or: [{ userId }, { sharedWith: userId }],
        };

    const rawFiles = await File.find(baseQuery)
      .populate("owner", "email")
      .sort({ uploadDate: -1 })
      .limit(200);

    const relevantFiles = rawFiles
      .map((f) => {
        const isOwner = f.owner?._id?.toString?.() === userId || f.userId?.toString?.() === userId;
        return {
          _id: f._id,
          originalName: f.originalName,
          filename: f.filename,
          mimetype: f.mimetype,
          uploadDate: f.uploadDate,
          ownerEmail: f.owner?.email || null,
          isShared: !isOwner,
          isFavorite: isFlaggedByUser(f.favoritedBy, userId),
          isPinned: isFlaggedByUser(f.pinnedBy, userId),
          isDuplicate: !!f.duplicateOf,
          classification: f.classification || null,
          relevanceScore: scoreRelevantFile(f, userId),
        };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 8);

    const requiresAction = rawFiles
      .map((f) => {
        const actions = [];
        if (f.duplicateOf) actions.push("Duplicate detected");
        if ((f.classification?.confidence || 1) < 0.6) actions.push("Low classification confidence");
        if (f.sharedWith?.some((id) => id?.toString?.() === userId) && canRoleEdit(f.permissions)) {
          actions.push("Shared with editor access - review needed");
        }
        if (!actions.length) return null;
        return {
          fileId: f._id,
          originalName: f.originalName,
          actions,
          priority: actions.length >= 2 ? "high" : "medium",
        };
      })
      .filter(Boolean)
      .slice(0, 10);

    const accessLogs = await Log.find({
      user: userId,
      action: "ACCESS_FILE",
      date: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) },
    })
      .sort({ date: -1 })
      .limit(80);

    const recentAccessItems = [];
    const seenAccess = new Set();
    for (const item of accessLogs) {
      const parsed = parseAccessDetails(item.details);
      if (!parsed?.fileId || seenAccess.has(parsed.fileId)) continue;
      seenAccess.add(parsed.fileId);
      recentAccessItems.push({ fileId: parsed.fileId, lastAction: parsed.action, at: item.date });
      if (recentAccessItems.length >= 8) break;
    }
    const recentIds = recentAccessItems.map((i) => i.fileId);
    const recentFilesRaw = recentIds.length
      ? await File.find({ _id: { $in: recentIds }, deletedAt: null }).select("_id originalName filename mimetype")
      : [];
    const recentMap = new Map(recentFilesRaw.map((f) => [f._id.toString(), f]));
    const recentAccessed = recentAccessItems
      .map((item) => {
        const f = recentMap.get(item.fileId);
        if (!f) return null;
        return {
          _id: f._id,
          originalName: f.originalName,
          filename: f.filename,
          mimetype: f.mimetype,
          lastAction: item.lastAction,
          lastAccessedAt: item.at,
        };
      })
      .filter(Boolean);

    const timeline = await Log.find({ user: userId })
      .sort({ date: -1 })
      .limit(30);
    const timelineItems = timeline.map((entry) => ({
      _id: entry._id,
      action: entry.action,
      details: entry.details,
      date: entry.date || entry.timeStamp,
    }));

    res.json({
      relevantFiles,
      requiresAction,
      recentAccessed,
      timeline: timelineItems,
      stats: {
        relevantCount: relevantFiles.length,
        actionRequiredCount: requiresAction.length,
        recentAccessCount: recentAccessed.length,
      },
    });
  } catch (err) {
    console.error("Personalized dashboard error:", err);
    res.status(500).json({ error: "Failed to fetch personalized dashboard" });
  }
});

// View file inline
app.get("/view/:filename", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const doc = await File.findOne({ filename: req.params.filename }).populate("owner");
    if (!doc) return res.status(404).send("File not found");

    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = hasGlobalViewAccess(actorRole);
    if (!isAdmin) {
      if (!(await userHasFileAccess(doc, userId, actorRole))) {
        return res.status(403).send("You don't have permission to view this file");
      }
    }

    if (userId) {
      doc.lastAccessedAt = new Date();
      await doc.save();
      createLog("ACCESS_FILE", userId, encodeAccessDetails("VIEW", doc));
    }

    const filePath = path.join(__dirname, "uploads", req.params.filename);

    // Compute a reliable content type for inline preview
    const ext = (doc.originalName || "").toLowerCase();
    let contentType = doc.mimetype || "application/octet-stream";
    if (ext.endsWith(".pdf")) contentType = "application/pdf";
    if (ext.endsWith(".png")) contentType = "image/png";
    if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) contentType = "image/jpeg";
    if (ext.endsWith(".gif")) contentType = "image/gif";

    // Set appropriate headers for browser preview
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(doc.originalName)}"`
    );
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Send file for preview
    res.sendFile(filePath);
  } catch (err) {
    console.error("View file error:", err);
    res.status(500).send("Server error");
  }
});

app.get("/preview/:filename", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const doc = await File.findOne({ filename: req.params.filename }).populate("owner");
    if (!doc) return res.status(404).send("File not found");

    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = hasGlobalViewAccess(actorRole);
    if (!isAdmin) {
      if (!(await userHasFileAccess(doc, userId, actorRole))) return res.status(403).send("Forbidden");
    }

    const ext = (doc.originalName || "").toLowerCase();
    const filename = req.params.filename;
    const filePath = path.join(__dirname, "uploads", filename);
    const extOnly = path.extname(ext);
    const isPdf = doc.mimetype?.includes("pdf") || extOnly === ".pdf";
    const isImage = doc.mimetype?.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif"].includes(extOnly);
    const isText = doc.mimetype?.startsWith("text/") || ["application/json", "application/xml"].includes(doc.mimetype) || [".txt", ".json", ".xml", ".csv"].includes(extOnly);
    const isDocx = doc.mimetype?.includes("vnd.openxmlformats-officedocument.wordprocessingml.document") || extOnly === ".docx";
    const isXlsx = doc.mimetype?.includes("spreadsheetml") || doc.mimetype?.includes("vnd.ms-excel") || [".xlsx", ".xls"].includes(extOnly);
    const isPptx = doc.mimetype?.includes("presentationml") || [".pptx", ".ppt"].includes(extOnly);

    if (isPdf) {
      const url = `/view/${encodeURIComponent(filename)}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${doc.originalName}</title><style>html,body{height:100%;margin:0}embed,iframe{width:100%;height:100%;border:0}</style></head><body><embed src="${url}" type="application/pdf"/></body></html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }

    if (isImage) {
      const url = `/view/${encodeURIComponent(filename)}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${doc.originalName}</title><style>html,body{height:100%;margin:0}img{max-width:100%;max-height:100%;display:block;margin:auto}</style></head><body><img src="${url}" alt="preview"/></body></html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }

    if (isText) {
      if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
      const raw = fs.readFileSync(filePath, "utf8");
      const escaped = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${doc.originalName}</title><style>html,body{height:100%;margin:0}pre{white-space:pre-wrap;word-wrap:break-word;padding:16px;font-family:ui-monospace,monospace}</style></head><body><pre>${escaped}</pre></body></html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }

    if (isDocx) {
      if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
      const mammoth = require("mammoth");
      try {
        const result = await mammoth.convertToHtml({ path: filePath });
        const htmlBody = result.value || "";
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${doc.originalName}</title><style>body{font:16px/1.5 system-ui,Segoe UI,Roboto,Helvetica,Arial;padding:20px;color:#1f2937} h1,h2,h3{margin:1em 0 .5em} p{margin:.5em 0}</style></head><body>${htmlBody}</body></html>`;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
      } catch (e) {
        return res.status(500).send("Failed to preview DOCX");
      }
    }

    if (isXlsx) {
      if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
      try {
        const XLSX = require("xlsx");
        const workbook = XLSX.readFile(filePath, { cellHTML: false, cellText: true });
        let sheetsHtml = "";
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const table = XLSX.utils.sheet_to_html(sheet);
          sheetsHtml += `<section><h3>${sheetName}</h3>${table}</section>`;
        }
        const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${doc.originalName}</title><style>body{font:14px/1.4 system-ui,Arial;padding:16px;color:#111} h3{margin:16px 0 8px} table{border-collapse:collapse;max-width:100%;overflow:auto;display:block} table,td,th{border:1px solid #ddd} td,th{padding:6px 8px;vertical-align:top;}</style></head><body>${sheetsHtml}</body></html>`;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(html);
      } catch (e) {
        return res.status(500).send("Failed to preview Excel");
      }
    }

    if (isPptx) {
      const dl = `/download/${encodeURIComponent(filename)}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${doc.originalName}</title><style>body{font:16px/1.5 system-ui,Segoe UI,Roboto,Helvetica,Arial;padding:24px;color:#1f2937} .card{border:1px solid #e5e7eb;border-radius:8px;padding:16px;max-width:640px;margin:auto} a.btn{display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px} p{margin:.5em 0}</style></head><body><div class="card"><h2>PowerPoint Preview</h2><p>PPTX cannot be rendered inline. Please download to open locally.</p><a class="btn" href="${dl}">Download PPTX</a></div></body></html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    }

    const url = `/view/${encodeURIComponent(filename)}?userId=${encodeURIComponent(userId || "")}&role=${encodeURIComponent(role || "")}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${doc.originalName}</title><style>html,body{height:100%;margin:0}iframe{width:100%;height:100%;border:0}</style></head><body><iframe src="${url}"></iframe></body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).send("Server error");
  }
});
// Download file
app.get("/download/:filename", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const doc = await File.findOne({ filename: req.params.filename });
    if (!doc) return res.status(404).send("File not found");

    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = hasGlobalViewAccess(actorRole);
    if (!isAdmin) {
      if (!(await userHasFileAccess(doc, userId, actorRole))) {
        return res.status(403).send("You don't have permission to download this file");
      }
    }

    if (userId) {
      doc.lastAccessedAt = new Date();
      await doc.save();
      createLog("ACCESS_FILE", userId, encodeAccessDetails("DOWNLOAD", doc));
    }

    const filePath = path.join(__dirname, "uploads", req.params.filename);
    const finalName = ensureExtension(doc.originalName, doc.mimetype);
    const safeName = finalName.replace(/[\\"]/g, "_").replace(/\r?\n/g, "");
    const contentType = getContentType(finalName, doc.mimetype);
    const encoded = encodeURIComponent(safeName);
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`
    );
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Soft delete file ? moves to Trash
app.delete("/files/:id", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = canDeleteDocuments(actorRole);
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });
    if (file.parentFolder && await isFolderWithinLockedCopc(file.parentFolder)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }

    if (!isAdmin) {
      return res.status(403).json({ error: "Not authorized to delete documents" });
    }

    file.deletedAt = new Date();
    await file.save();
    await reconcileDuplicateGroup(file.contentHash);

    // NEW: log soft delete
    createLog("DELETE_FILE", file.owner, `Moved to trash: ${file.originalName}`);

    res.json({ status: "moved-to-trash", file });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Move file
app.patch("/files/:id/move", async (req, res) => {
  try {
    const { newFolderId, userId, role } = req.body;
    const actorRole = await resolveActorRole(userId, role);
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const ownerId = file.owner?.toString?.() || file.userId?.toString?.() || file.userId;
    const isOwner = !!userId && ownerId?.toString() === userId.toString();
    const isAdmin = canEditAnyDocuments(actorRole);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to move this file" });
    }
    if (file.parentFolder && await isFolderWithinLockedCopc(file.parentFolder)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }

    if (newFolderId) {
      const targetFolder = await Folder.findById(newFolderId).select("owner folderAssignments complianceTasks deletedAt");
      if (!targetFolder || targetFolder.deletedAt) {
        return res.status(404).json({ error: "Destination folder not found" });
      }
      if (await isFolderWithinLockedCopc(newFolderId)) {
        return res.status(423).json({ error: "Destination COPC scope is locked after final approval" });
      }
      if (!canUploadToFolder(targetFolder, userId, actorRole)) {
        return res.status(403).json({ error: "You are not assigned to upload in destination folder" });
      }
    }

    const oldFolderId = file.parentFolder ? file.parentFolder.toString() : null;
    const nextFolderId = newFolderId || null;
    file.parentFolder = nextFolderId;
    if (newFolderId) {
      const targetFolder = await Folder.findById(newFolderId).select("folderAssignments");
      if (targetFolder) file.reviewWorkflow = buildFileWorkflowFromFolder(targetFolder);
    }
    await file.save();

    const latestVersion = await FileVersion.findOne({ fileId: file._id }).sort({
      versionNumber: -1,
    });
    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await FileVersion.updateMany({ fileId: file._id }, { isCurrent: false });
    const version = await FileVersion.create({
      fileId: file._id,
      versionNumber,
      originalName: file.originalName,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      createdBy: userId || file.owner,
      changeDescription: `Moved from "${oldFolderId || "Root"}" to "${nextFolderId || "Root"}"`,
      isCurrent: true,
    });

    createLog(
      "MOVE_FILE",
      userId || file.owner,
      `Moved ${file.originalName} to folder ${nextFolderId || "Root"}`
    );
    res.json({ status: "success", file, version });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Get single file
app.get("/files/:id", async (req, res) => {
  try {
    const file = await File.findById(req.params.id).populate("owner", "email").populate("sharedWith", "email");
    if (!file) return res.status(404).json({ error: "File not found" });
    res.json(file);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get editable document content
app.get("/files/:id/content", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const file = await File.findById(req.params.id).populate("owner");
    if (!file) return res.status(404).json({ error: "File not found" });
    if (!(await userHasFileAccess(file, userId, role))) {
      return res.status(403).json({ error: "Not authorized to view file content" });
    }
    if (!isEditableDocument(file)) {
      return res.status(400).json({ error: "This file type is not editable in-app" });
    }

    if (userId) {
      file.lastAccessedAt = new Date();
      await file.save();
      createLog("ACCESS_FILE", userId, encodeAccessDetails("EDITOR_OPEN", file));
    }

    const filePath = path.join(__dirname, "uploads", file.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File missing on disk" });
    }

    const { kind, content } = await extractEditableContent(filePath, file);
    res.json({
      fileId: file._id,
      originalName: file.originalName,
      mimetype: file.mimetype,
      kind,
      content,
    });
  } catch (err) {
    console.error("Get file content error:", err);
    res.status(500).json({ error: "Failed to fetch file content" });
  }
});

// Save editable document content
app.patch("/files/:id/content", async (req, res) => {
  try {
    const { userId, role, content, changeDescription } = req.body || {};
    if (isReadOnlyReviewerRole(role)) {
      return res.status(403).json({ error: "Reviewer role is read-only and cannot edit files" });
    }
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Content must be a string" });
    }

    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });
    if (file.parentFolder && await isFolderWithinLockedCopc(file.parentFolder)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }
    if (!isEditableDocument(file)) {
      return res.status(400).json({ error: "This file type is not editable in-app" });
    }

    const canEdit = await canUserEditFile(file, userId, role);
    if (!canEdit) {
      return res.status(403).json({ error: "Not authorized to edit this file" });
    }

    const filePath = path.join(__dirname, "uploads", file.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File missing on disk" });
    }

    await writeEditedContent(filePath, file, content);
    const previousHash = file.contentHash || null;
    const sizeBytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : Buffer.byteLength(content, "utf8");

    file.size = sizeBytes;
    const newHash = await computeFileHash(filePath);
    file.contentHash = newHash;
    const extractedText = await extractTextForClassification(filePath, file.mimetype, file.originalName);
    const classificationResult = classifyDocument({
      originalName: file.originalName,
      mimetype: file.mimetype,
      text: extractedText,
    });
    file.classification = {
      category: classificationResult.category,
      confidence: classificationResult.confidence,
      tags: classificationResult.tags,
      classifiedAt: new Date(),
      classifierVersion: CLASSIFICATION_VERSION,
    };
    await file.save();

    const latestVersion = await FileVersion.findOne({ fileId: file._id }).sort({ versionNumber: -1 });
    const nextVersion = latestVersion ? latestVersion.versionNumber + 1 : 1;
    await FileVersion.updateMany({ fileId: file._id }, { isCurrent: false });
    const version = await FileVersion.create({
      fileId: file._id,
      versionNumber: nextVersion,
      originalName: file.originalName,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      createdBy: userId || file.owner,
      changeDescription: changeDescription || "Edited in built-in document editor",
      isCurrent: true,
    });

    if (previousHash && previousHash !== newHash) {
      await reconcileDuplicateGroup(previousHash);
    }
    await reconcileDuplicateGroup(newHash);

    createLog("EDIT_FILE_CONTENT", userId || file.owner, `Edited ${file.originalName} in built-in editor`);
    res.json({ success: true, file, version });
  } catch (err) {
    console.error("Save file content error:", err);
    res.status(500).json({ error: "Failed to save file content" });
  }
});

// Share file
app.patch("/files/:id/share", async (req, res) => {
  try {
    const { emails, permission, userId, role } = req.body;
    const users = await UserModel.find({ email: { $in: emails } });
    if (!users.length)
      return res.status(404).json({ error: "No matching users found" });

    const userIds = users.map((u) => u._id);
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const ownerId = file.owner?.toString?.() || file.userId?.toString?.() || file.userId;
    const isOwner = !!userId && ownerId?.toString() === userId.toString();
    const isAdmin = await isAdminContext(role, userId);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to share this file" });
    }

    const nextShared = new Set(
      (file.sharedWith || []).map((id) => id?.toString?.() || id)
    );
    userIds.forEach((id) => nextShared.add(id?.toString?.() || id));
    file.sharedWith = Array.from(nextShared);
    if (permission) file.permissions = normalizePermissionRole(permission, "viewer");

    await file.save();
    await file.populate("sharedWith", "email");

    // NEW: log share
    createLog("SHARE_FILE", file.owner, `Shared ${file.originalName} with ${emails.join(", ")}`);

    // Create notifications for shared users
    await createNotificationsForUsers(
      userIds,
      "SHARE_FILE",
      "File shared with you",
      `"${file.originalName}" has been shared with you.`,
      `Permission: ${file.permissions}`,
      file._id,
      "File",
      {
        actorId: userId,
        metadata: {
          fileName: file.originalName,
          permission: file.permissions,
        },
      }
    );

    res.json({ status: "success", file });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Unshare file (remove user from sharedWith)
app.patch("/files/:id/unshare", async (req, res) => {
  try {
    const { userId, actorId, role } = req.body;
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const ownerId = file.owner?.toString?.() || file.userId?.toString?.() || file.userId;
    const isOwner = !!actorId && ownerId?.toString() === actorId.toString();
    const isAdmin = await isAdminContext(role, actorId);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to unshare this file" });
    }

    file.sharedWith = file.sharedWith.filter(id => id.toString() !== userId.toString());
    await file.save();
    await file.populate("sharedWith", "email");

    // NEW: log unshare
    createLog("UNSHARE_FILE", file.owner, `Removed access from file ${file.originalName}`);

    res.json({ status: "success", file });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

/* ========================
   FOLDERS
======================== */
// Create folder
app.post("/folders", async (req, res) => {
  try {
    const { name, owner, parentFolder, role, isPredefinedRoot, predefinedTemplateKey } = req.body;
    if (isReadOnlyReviewerRole(role)) {
      return res.status(403).json({ error: "Reviewer role is read-only and cannot create folders" });
    }
    if (!name || !owner)
      return res.status(400).json({ error: "Missing folder name or owner" });

    const isAdmin = await isAdminContext(role, owner);
    if (parentFolder && await isFolderWithinLockedCopc(parentFolder)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }

    const folder = new Folder({
      name,
      owner,
      parentFolder: parentFolder || null,
      isPredefinedRoot: !!(isAdmin && isPredefinedRoot),
      predefinedTemplateKey: isAdmin && isPredefinedRoot ? (predefinedTemplateKey || null) : null,
      sharedWith: [],
      permissions: "owner",
    });

    await folder.save();

    const latestVersion = await FolderVersion.findOne({ folderId: folder._id }).sort({
      versionNumber: -1,
    });
    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await FolderVersion.updateMany({ folderId: folder._id }, { isCurrent: false });
    await FolderVersion.create({
      folderId: folder._id,
      versionNumber,
      name: folder.name,
      createdBy: owner,
      changeDescription: "Initial folder creation",
      changes: { type: "create" },
      isCurrent: true,
    });

    // NEW: log folder creation
    createLog("CREATE_FOLDER", owner, `Created folder ${name}`);

    res.json({ success: true, folder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get folders
app.get("/folders", async (req, res) => {
  try {
    const { userId, role, parentFolder, sortBy, sortOrder } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    let query = { deletedAt: null };

    if (parentFolder) query.parentFolder = parentFolder;
    else query.parentFolder = null;

    let sortOptions = {};
    if (sortBy === "name") {
      sortOptions.name = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "date") {
      sortOptions.createdAt = sortOrder === "desc" ? -1 : 1;
    } else {
      sortOptions.createdAt = -1;
    }

    if (hasGlobalViewAccess(actorRole)) {
      const folders = await Folder.find(query)
        .populate("owner", "email")
        .sort(sortOptions);
      return res.json(
        folders.map((folder) => {
          const { progress } = computeTaskProgress(folder.complianceTasks || []);
          return {
            ...folder.toObject(),
            isShared: false,
            permission: "owner",
            ownerEmail: folder.owner?.email || null,
            complianceProgress: progress,
          };
        })
      );
    }

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // Strict visibility: load candidate folders in the current level and scope by assignment access.
    const candidateFolders = await Folder.find(query)
      .populate("owner", "email")
      .sort(sortOptions);

    // Remove duplicates
    const seenIds = new Set();
    const uniqueFolders = candidateFolders.filter(folder => {
      if (seenIds.has(folder._id.toString())) return false;
      seenIds.add(folder._id.toString());
      return true;
    });

    const accessCache = new Map();
    const accessibleFolders = [];
    for (const folder of uniqueFolders) {
      if (await canUserAccessFolderByAssignment(folder._id, userId, actorRole, accessCache)) {
        accessibleFolders.push(folder);
      }
    }

    // Add owner and permission info for all folders
    const foldersWithPermissions = accessibleFolders.map(folder => {
      const isOwner = folder.owner._id.toString() === userId;
      const { progress } = computeTaskProgress(folder.complianceTasks || []);
      return {
        ...folder.toObject(),
        isShared: !isOwner,
        permission: isOwner ? "owner" : normalizePermissionRole(folder.permissions, "viewer"),
        ownerEmail: folder.owner?.email || null,
        complianceProgress: progress,
      };
    });

    res.json(foldersWithPermissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all folders (for move modal)
app.get("/folders/all", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    let folders = [];

    if (hasGlobalViewAccess(actorRole)) {
      folders = await Folder.find({ deletedAt: null }).sort({ createdAt: -1 });
    } else {
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      folders = await Folder.find({ deletedAt: null }).sort({ createdAt: -1 });

      // Remove duplicates
      const seenIds = new Set();
      folders = folders.filter(folder => {
        if (seenIds.has(folder._id.toString())) return false;
        seenIds.add(folder._id.toString());
        return true;
      });

      const accessCache = new Map();
      const scoped = [];
      for (const folder of folders) {
        if (await canUserAccessFolderByAssignment(folder._id, userId, actorRole, accessCache)) {
          scoped.push(folder);
        }
      }
      folders = scoped;
    }

    // Prune orphan folders whose parent is missing from this non-deleted set.
    // This removes descendants of previously deleted roots from selectors.
    let pruned = Array.isArray(folders) ? [...folders] : [];
    let changed = true;
    while (changed) {
      changed = false;
      const idSet = new Set(pruned.map((f) => String(f._id)));
      const next = pruned.filter((f) => !f.parentFolder || idSet.has(String(f.parentFolder)));
      if (next.length !== pruned.length) {
        changed = true;
        pruned = next;
      }
    }

    res.json(pruned);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Move folder
app.patch("/folders/:id/move", async (req, res) => {
  try {
    const { newFolderId, userId, role } = req.body;
    const actorRole = await resolveActorRole(userId, role);
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const ownerId = folder.owner?.toString?.() || folder.owner;
    const isOwner = !!userId && ownerId?.toString() === userId.toString();
    const isAdmin = canEditAnyDocuments(actorRole);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to move this folder" });
    }
    if (await isFolderWithinLockedCopc(folder._id)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }
    if (newFolderId && await isFolderWithinLockedCopc(newFolderId)) {
      return res.status(423).json({ error: "Destination COPC scope is locked after final approval" });
    }
    if (newFolderId && String(newFolderId) === String(folder._id)) {
      return res.status(400).json({ error: "Cannot move a folder into itself" });
    }

    if (newFolderId) {
      const targetFolder = await Folder.findById(newFolderId).select("owner folderAssignments complianceTasks deletedAt");
      if (!targetFolder || targetFolder.deletedAt) {
        return res.status(404).json({ error: "Destination folder not found" });
      }

      const descendantIds = await getDescendantFolderIds(folder._id);
      if (descendantIds.map((id) => String(id)).includes(String(newFolderId))) {
        return res.status(400).json({ error: "Cannot move a folder into its child scope" });
      }

      if (!isAdmin && !canUploadToFolder(targetFolder, userId, actorRole)) {
        return res.status(403).json({ error: "You are not assigned to move folders into destination folder" });
      }
    }

    const oldFolderId = folder.parentFolder ? folder.parentFolder.toString() : null;
    const nextFolderId = newFolderId || null;
    if (String(oldFolderId || "") === String(nextFolderId || "")) {
      return res.json({ status: "success", folder, version: null, unchanged: true });
    }
    folder.parentFolder = nextFolderId;
    await folder.save();

    const latestVersion = await FolderVersion.findOne({ folderId: folder._id }).sort({
      versionNumber: -1,
    });
    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await FolderVersion.updateMany({ folderId: folder._id }, { isCurrent: false });
    const version = await FolderVersion.create({
      folderId: folder._id,
      versionNumber,
      name: folder.name,
      createdBy: userId || folder.owner,
      changeDescription: `Moved from "${oldFolderId || "Root"}" to "${nextFolderId || "Root"}"`,
      changes: { type: "move", from: oldFolderId, to: nextFolderId },
      isCurrent: true,
    });

    createLog(
      "MOVE_FOLDER",
      userId || folder.owner,
      `Moved folder ${folder.name} to folder ${nextFolderId || "Root"}`
    );
    res.json({ status: "success", folder, version });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Soft delete folder ? moves to Trash
app.delete("/folders/:id", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    if (!canDeleteDocuments(actorRole)) {
      return res.status(403).json({ error: "Not authorized to delete folders" });
    }
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (await isFolderWithinLockedCopc(folder._id)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }
    const deletedIds = await softDeleteFolderTree(folder._id, new Date());

    // NEW: log folder soft delete
    createLog("DELETE_FOLDER", folder.owner, `Moved to trash: ${folder.name}`);

    res.json({ status: "moved-to-trash", folder, deletedCount: deletedIds.length });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Get single folder
app.get("/folders/:id", async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id).populate("owner", "email").populate("sharedWith", "email");
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    res.json(folder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Program Chair review stage
app.patch("/files/:id/review/program-chair", async (req, res) => {
  try {
    const { userId, role, action, notes } = req.body || {};
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !isProgramChairRole(actorRole)) {
      return res.status(403).json({ error: "Only super admin or department chair can review this stage" });
    }

    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });
    const workflow = file.reviewWorkflow || {};
    if (!workflow.requiresReview) {
      return res.status(400).json({ error: "This file does not require review" });
    }
    if (!workflow.programChair || workflow.programChair.status === "not_required") {
      return res.status(400).json({ error: "Program chair review is not required for this file" });
    }
    const assignedChairs = Array.isArray(workflow.assignedProgramChairs) ? workflow.assignedProgramChairs : [];
    if (!isAdmin && assignedChairs.length === 0) {
      return res.status(403).json({ error: "No department chair is assigned to this document" });
    }
    if (!isAdmin && !isUserAssignedTo(userId, assignedChairs)) {
      return res.status(403).json({ error: "You are not assigned to review this document as department chair" });
    }

    const normalizedAction = String(action || "").toLowerCase();
    if (!["approve", "reject"].includes(normalizedAction)) {
      return res.status(400).json({ error: "Action must be approve or reject" });
    }

    workflow.programChair = {
      ...workflow.programChair,
      status: normalizedAction === "approve" ? "approved" : "rejected",
      reviewedBy: userId,
      reviewedAt: new Date(),
      notes: String(notes || ""),
    };

    if (normalizedAction === "reject") {
      workflow.status = "rejected_program_chair";
      if (workflow.qaOfficer && workflow.qaOfficer.status !== "not_required") {
        workflow.qaOfficer.status = "pending";
        workflow.qaOfficer.reviewedBy = null;
        workflow.qaOfficer.reviewedAt = null;
        workflow.qaOfficer.notes = "";
      }
    } else {
      const qaRequired = workflow.qaOfficer && workflow.qaOfficer.status !== "not_required";
      workflow.status = qaRequired ? "pending_qa" : "approved";
    }

    file.reviewWorkflow = workflow;
    await file.save();
    if (file.parentFolder) {
      await updateCopcStage(
        file.parentFolder,
        normalizedAction === "reject" ? "revision" : "department_review",
        normalizedAction === "reject" ? "Revision Requested" : "Department Review Completed"
      );
    }
    createLog("PROGRAM_CHAIR_REVIEW", userId, `${normalizedAction} file ${file.originalName}`);

    await createNotification(
      file.owner,
      normalizedAction === "approve" ? "COPC_REVIEW_APPROVED" : "COPC_REVIEW_REJECTED",
      normalizedAction === "approve" ? "Department review approved" : "Department review requires revision",
      normalizedAction === "approve"
        ? `"${file.originalName}" passed department chair review.`
        : `"${file.originalName}" was returned for revision by the department chair.`,
      String(notes || "").trim() || (normalizedAction === "approve" ? "Approved at department review stage." : "Please review the feedback and resubmit."),
      file._id,
      "File",
      {
        actorId: userId,
        metadata: {
          fileName: file.originalName,
          stage: "program_chair",
          action: normalizedAction,
        },
      }
    );

    if (normalizedAction === "approve" && Array.isArray(workflow.assignedQaOfficers) && workflow.assignedQaOfficers.length > 0) {
      await createNotificationsForUsers(
        workflow.assignedQaOfficers,
        "REVIEW_REQUIRED",
        "Document ready for QA review",
        `"${file.originalName}" is ready for QA review.`,
        "Department chair review has been completed.",
        file._id,
        "File",
        {
          actorId: userId,
          metadata: {
            fileName: file.originalName,
            stage: "qa",
          },
        }
      );
    }

    res.json({ success: true, reviewWorkflow: file.reviewWorkflow });
  } catch (err) {
    res.status(500).json({ error: "Failed to process program chair review" });
  }
});

// QA/COPC review stage
app.patch("/files/:id/review/qa", async (req, res) => {
  try {
    const { userId, role, action, notes } = req.body || {};
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !isQaReviewRole(actorRole)) {
      return res.status(403).json({ error: "Only super admin or QA admin can review this stage" });
    }

    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });
    const workflow = file.reviewWorkflow || {};
    if (!workflow.requiresReview) {
      return res.status(400).json({ error: "This file does not require review" });
    }
    if (!workflow.qaOfficer || workflow.qaOfficer.status === "not_required") {
      return res.status(400).json({ error: "QA review is not required for this file" });
    }
    if (workflow.programChair && workflow.programChair.status === "pending") {
      return res.status(400).json({ error: "Program chair review must be completed first" });
    }
    const assignedQa = Array.isArray(workflow.assignedQaOfficers) ? workflow.assignedQaOfficers : [];
    if (!isAdmin && assignedQa.length === 0) {
      return res.status(403).json({ error: "No QA admin is assigned to this document" });
    }
    if (!isAdmin && !isUserAssignedTo(userId, assignedQa)) {
      return res.status(403).json({ error: "You are not assigned to review this document as QA admin" });
    }

    const normalizedAction = String(action || "").toLowerCase();
    if (!["approve", "reject", "request_missing_files"].includes(normalizedAction)) {
      return res.status(400).json({ error: "Action must be approve, reject, or request_missing_files" });
    }
    const effectiveAction = normalizedAction === "request_missing_files" ? "reject" : normalizedAction;
    const resolvedNotes = normalizedAction === "request_missing_files"
      ? (String(notes || "").trim()
        ? `Missing files requested: ${String(notes || "").trim()}`
        : "Missing files requested by QA Admin.")
      : String(notes || "");

    workflow.qaOfficer = {
      ...workflow.qaOfficer,
      status: effectiveAction === "approve" ? "approved" : "rejected",
      reviewedBy: userId,
      reviewedAt: new Date(),
      notes: resolvedNotes,
    };
    workflow.status = effectiveAction === "approve" ? "approved" : "rejected_qa";
    workflow.verificationBadge = {
      verified: effectiveAction === "approve",
      verifiedBy: effectiveAction === "approve" ? userId : null,
      verifiedAt: effectiveAction === "approve" ? new Date() : null,
      label: effectiveAction === "approve" ? "Verified by QA Office" : "Pending Verification",
    };

    file.reviewWorkflow = workflow;
    await file.save();
    if (file.parentFolder) {
      await updateCopcStage(
        file.parentFolder,
        effectiveAction === "approve" ? "qa_verification" : "revision",
        effectiveAction === "approve"
          ? "QA Verification Completed"
          : normalizedAction === "request_missing_files"
            ? "Missing Files Requested"
            : "Needs Correction"
      );
    }
    createLog("QA_REVIEW", userId, `${normalizedAction} file ${file.originalName}`);

    await createNotification(
      file.owner,
      effectiveAction === "approve" ? "COPC_REVIEW_APPROVED" : "COPC_REVIEW_REJECTED",
      effectiveAction === "approve" ? "QA review approved" : "QA review requires action",
      effectiveAction === "approve"
        ? `"${file.originalName}" passed QA review.`
        : `"${file.originalName}" requires action after QA review.`,
      resolvedNotes || (effectiveAction === "approve" ? "Verified by QA Office." : "Please review the QA feedback and update the file."),
      file._id,
      "File",
      {
        actorId: userId,
        metadata: {
          fileName: file.originalName,
          stage: "qa",
          action: normalizedAction,
        },
      }
    );

    res.json({ success: true, action: normalizedAction, reviewWorkflow: file.reviewWorkflow });
  } catch (err) {
    res.status(500).json({ error: "Failed to process QA review" });
  }
});

// QA admin tagging for compliance category
app.patch("/files/:id/review/qa/tag-category", async (req, res) => {
  try {
    const { userId, role, category, tags } = req.body || {};
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !isQaReviewRole(actorRole)) {
      return res.status(403).json({ error: "Only super admin or QA admin can tag compliance category" });
    }

    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });
    const workflow = file.reviewWorkflow || {};
    if (!workflow.requiresReview) {
      return res.status(400).json({ error: "This file does not require COPC review" });
    }
    if (!workflow.qaOfficer || workflow.qaOfficer.status === "not_required") {
      return res.status(400).json({ error: "QA review is not required for this file" });
    }
    const assignedQa = Array.isArray(workflow.assignedQaOfficers) ? workflow.assignedQaOfficers : [];
    if (!isAdmin && assignedQa.length === 0) {
      return res.status(403).json({ error: "No QA admin is assigned to this document" });
    }
    if (!isAdmin && !isUserAssignedTo(userId, assignedQa)) {
      return res.status(403).json({ error: "You are not assigned to tag this document as QA admin" });
    }

    const normalizedCategory = String(category || "").trim();
    if (!normalizedCategory) {
      return res.status(400).json({ error: "Compliance category is required" });
    }
    const normalizedTags = Array.isArray(tags)
      ? tags
      : String(tags || "")
          .split(",")
          .map((tag) => String(tag || "").trim())
          .filter(Boolean);
    const uniqueTags = Array.from(new Set(normalizedTags)).slice(0, 20);

    const existing = file.classification || {};
    file.classification = {
      ...existing,
      category: normalizedCategory,
      tags: uniqueTags,
      confidence: Number.isFinite(Number(existing.confidence)) ? Number(existing.confidence) : 0.95,
      classifiedAt: new Date(),
      classifierVersion: "qa-manual-v1",
    };
    await file.save();

    createLog("QA_TAG_COMPLIANCE_CATEGORY", userId, `Tagged ${file.originalName} as ${normalizedCategory}`);
    res.json({ success: true, classification: file.classification });
  } catch (err) {
    res.status(500).json({ error: "Failed to tag compliance category" });
  }
});

// Get folder compliance tasks + assignments
app.get("/folders/:id/tasks", async (req, res) => {
  try {
    const { userId, role } = req.query || {};
    const folder = await Folder.findById(req.params.id)
      .populate("folderAssignments.uploaders", "email name role")
      .populate("folderAssignments.programChairs", "email name role")
      .populate("folderAssignments.qaOfficers", "email name role")
      .populate("folderAssignments.evaluators", "email name role");
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const ownerId = folder.owner?.toString?.() || folder.owner?._id?.toString?.();
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    const isOwner = ownerId && userId && ownerId.toString() === userId.toString();
    const isAssignedScope = await canUserAccessFolderByAssignment(folder._id, userId, actorRole);
    const canView = canViewCompliance(actorRole) || isAdmin || isOwner || isAssignedScope;
    if (!canView) return res.status(403).json({ error: "Not authorized to view folder tasks" });

    const { normalized, progress, totalNodes } = computeTaskProgress(folder.complianceTasks || []);
    const programChairReviews = (folder.complianceReviews || []).filter((r) => isProgramChairRole(r.role));
    const qaReviews = (folder.complianceReviews || []).filter((r) => isQaReviewRole(r.role));
    const root = await findCopcRootFolderByFolderId(folder._id);
    const fallbackAssignments = folder.folderAssignments || {};
    const rootAssignments = root?.folderAssignments || {};
    const prefer = (rootList, fallbackList) => {
      const primary = Array.isArray(rootList) ? rootList : [];
      if (primary.length > 0) return primary;
      return Array.isArray(fallbackList) ? fallbackList : [];
    };
    const poolIds = {
      uploaders: prefer(rootAssignments.uploaders, fallbackAssignments.uploaders),
      programChairs: prefer(rootAssignments.programChairs, fallbackAssignments.programChairs),
      qaOfficers: prefer(rootAssignments.qaOfficers, fallbackAssignments.qaOfficers),
      evaluators: prefer(rootAssignments.evaluators, fallbackAssignments.evaluators),
    };
    const uniquePoolIds = Array.from(
      new Set(
        Object.values(poolIds)
          .flat()
          .map((entry) => entry?._id?.toString?.() || entry?.toString?.())
          .filter(Boolean)
      )
    );
    const poolUsers = uniquePoolIds.length
      ? await UserModel.find({ _id: { $in: uniquePoolIds } }).select("name email role")
      : [];
    const poolMap = new Map(poolUsers.map((u) => [String(u._id), u]));
    const mapUsers = (arr) =>
      (Array.isArray(arr) ? arr : [])
        .map((entry) => {
          const id = entry?._id?.toString?.() || entry?.toString?.();
          return id ? poolMap.get(String(id)) || null : null;
        })
        .filter(Boolean);

    res.json({
      folderId: folder._id,
      profileKey: folder.complianceProfileKey || null,
      tasks: normalized,
      progress,
      totalNodes,
      assignments: folder.folderAssignments || { uploaders: [], programChairs: [], qaOfficers: [], evaluators: [] },
      assignmentPool: {
        uploaders: mapUsers(poolIds.uploaders),
        programChairs: mapUsers(poolIds.programChairs),
        qaOfficers: mapUsers(poolIds.qaOfficers),
        evaluators: mapUsers(poolIds.evaluators),
      },
      reviews: {
        programChair: programChairReviews,
        qa: qaReviews,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch folder tasks" });
  }
});

// Replace folder compliance tasks + assignments (admin only)
app.put("/folders/:id/tasks", async (req, res) => {
  try {
    const { userId, role, tasks, assignments, profileKey } = req.body || {};
    const isAdmin = await isAdminContext(role, userId);
    if (!isAdmin) return res.status(403).json({ error: "Only super admin can modify tasks" });

    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    folder.complianceTasks = Array.isArray(tasks) ? tasks.map(normalizeTaskNode) : [];
    folder.complianceProfileKey = profileKey || folder.complianceProfileKey || null;
    if (assignments && typeof assignments === "object") {
      folder.folderAssignments = {
        uploaders: Array.isArray(assignments.uploaders) ? assignments.uploaders : folder.folderAssignments?.uploaders || [],
        programChairs: Array.isArray(assignments.programChairs) ? assignments.programChairs : folder.folderAssignments?.programChairs || [],
        qaOfficers: Array.isArray(assignments.qaOfficers) ? assignments.qaOfficers : folder.folderAssignments?.qaOfficers || [],
        evaluators: Array.isArray(assignments.evaluators) ? assignments.evaluators : folder.folderAssignments?.evaluators || [],
      };
    }
    await folder.save();

    createLog("UPDATE_FOLDER_TASKS", userId, `Updated compliance tasks for folder ${folder.name}`);
    const { normalized, progress } = computeTaskProgress(folder.complianceTasks || []);
    res.json({ success: true, tasks: normalized, progress, assignments: folder.folderAssignments || {} });
  } catch (err) {
    res.status(500).json({ error: "Failed to update folder tasks" });
  }
});

// Update folder assignments only (superadmin)
app.patch("/folders/:id/assignments", async (req, res) => {
  try {
    const { userId, role, assignments } = req.body || {};
    const actorRole = await resolveActorRole(userId, role);
    if (actorRole !== "superadmin") {
      return res.status(403).json({ error: "Only super admin can update folder assignments" });
    }
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (await isFolderWithinLockedCopc(folder._id)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }
    if (!assignments || typeof assignments !== "object") {
      return res.status(400).json({ error: "Assignments payload is required" });
    }

    const previousAssignments = {
      uploaders: [...(folder.folderAssignments?.uploaders || [])],
      programChairs: [...(folder.folderAssignments?.programChairs || [])],
      qaOfficers: [...(folder.folderAssignments?.qaOfficers || [])],
      evaluators: [...(folder.folderAssignments?.evaluators || [])],
    };

    const clean = (value) =>
      Array.from(
        new Set(
          (Array.isArray(value) ? value : [])
            .map((entry) => entry?._id?.toString?.() || entry?.toString?.())
            .filter(Boolean)
        )
      );

    folder.folderAssignments = {
      uploaders: clean(assignments.uploaders ?? folder.folderAssignments?.uploaders),
      programChairs: clean(assignments.programChairs ?? folder.folderAssignments?.programChairs),
      qaOfficers: clean(assignments.qaOfficers ?? folder.folderAssignments?.qaOfficers),
      evaluators: clean(assignments.evaluators ?? folder.folderAssignments?.evaluators),
    };
    await folder.save();
    createLog("UPDATE_FOLDER_ASSIGNMENTS", userId, `Updated assignments for folder ${folder.name}`);

    await createNotificationsForUsers(
      diffNotificationRecipients(folder.folderAssignments.uploaders, previousAssignments.uploaders),
      "ACTION_REQUIRED",
      "Assigned to folder uploads",
      `You were assigned to upload documents in folder "${folder.name}".`,
      folder.name,
      folder._id,
      "Folder",
      { actorId: userId, metadata: { folderName: folder.name } }
    );
    await createNotificationsForUsers(
      diffNotificationRecipients(folder.folderAssignments.programChairs, previousAssignments.programChairs),
      "ACTION_REQUIRED",
      "Assigned to folder review",
      `You were assigned as a department chair reviewer for folder "${folder.name}".`,
      folder.name,
      folder._id,
      "Folder",
      { actorId: userId, metadata: { folderName: folder.name } }
    );
    await createNotificationsForUsers(
      diffNotificationRecipients(folder.folderAssignments.qaOfficers, previousAssignments.qaOfficers),
      "ACTION_REQUIRED",
      "Assigned to QA review scope",
      `You were assigned as a QA reviewer for folder "${folder.name}".`,
      folder.name,
      folder._id,
      "Folder",
      { actorId: userId, metadata: { folderName: folder.name } }
    );
    await createNotificationsForUsers(
      diffNotificationRecipients(folder.folderAssignments.evaluators, previousAssignments.evaluators),
      "ACTION_REQUIRED",
      "Assigned to evaluation scope",
      `You were assigned as an evaluator for folder "${folder.name}".`,
      folder.name,
      folder._id,
      "Folder",
      { actorId: userId, metadata: { folderName: folder.name } }
    );

    res.json({ success: true, assignments: folder.folderAssignments });
  } catch (err) {
    res.status(500).json({ error: "Failed to update folder assignments" });
  }
});

// Add a task node (admin only)
app.post("/folders/:id/tasks", async (req, res) => {
  try {
    const { userId, role, parentTaskId, task } = req.body || {};
    const isAdmin = await isAdminContext(role, userId);
    if (!isAdmin) return res.status(403).json({ error: "Only super admin can add tasks" });

    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const nextTask = normalizeTaskNode(task || {});
    if (!parentTaskId) {
      folder.complianceTasks.push(nextTask);
    } else {
      const parent = findTaskById(folder.complianceTasks || [], parentTaskId);
      if (!parent) return res.status(404).json({ error: "Parent task not found" });
      parent.children = Array.isArray(parent.children) ? parent.children : [];
      parent.children.push(nextTask);
    }

    await folder.save();
    const { normalized, progress } = computeTaskProgress(folder.complianceTasks || []);
    res.json({ success: true, tasks: normalized, progress });
  } catch (err) {
    res.status(500).json({ error: "Failed to add task" });
  }
});

// Edit a task node (admin only for task structure/text)
app.patch("/folders/:id/tasks/:taskId", async (req, res) => {
  try {
    const { userId, role, updates } = req.body || {};
    const isAdmin = await isAdminContext(role, userId);
    if (!isAdmin) return res.status(403).json({ error: "Only super admin can edit task details" });

    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const task = findTaskById(folder.complianceTasks || [], req.params.taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const next = updates || {};
    if (typeof next.title === "string") task.title = next.title.trim() || task.title;
    if (typeof next.description === "string") task.description = next.description;
    if (typeof next.scope === "string") task.scope = next.scope;
    if (Array.isArray(next.checks)) task.checks = next.checks;
    if (Array.isArray(next.assignedUploaders)) task.assignedUploaders = next.assignedUploaders;
    if (Array.isArray(next.assignedProgramChairs)) task.assignedProgramChairs = next.assignedProgramChairs;
    if (Array.isArray(next.assignedQaOfficers)) task.assignedQaOfficers = next.assignedQaOfficers;
    if (next.status) task.status = next.status;
    if (typeof next.percentage !== "undefined") task.percentage = Number(next.percentage) || 0;

    await folder.save();
    const { normalized, progress } = computeTaskProgress(folder.complianceTasks || []);
    res.json({ success: true, tasks: normalized, progress });
  } catch (err) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

// Delete a task node (superadmin only)
app.delete("/folders/:id/tasks/:taskId", async (req, res) => {
  try {
    const { userId, role } = req.body || {};
    const isAdmin = await isAdminContext(role, userId);
    if (!isAdmin) return res.status(403).json({ error: "Only super admin can delete tasks" });

    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (await isFolderWithinLockedCopc(folder._id)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }

    const task = findTaskById(folder.complianceTasks || [], req.params.taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    removeTaskById(folder.complianceTasks || [], req.params.taskId);
    await folder.save();

    createLog("DELETE_FOLDER_TASK", userId, `Removed task from folder ${folder.name}`);
    const { normalized, progress } = computeTaskProgress(folder.complianceTasks || []);
    res.json({ success: true, tasks: normalized, progress });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Check task status (admin/program chair/qa)
app.patch("/folders/:id/tasks/:taskId/check", async (req, res) => {
  try {
    const { userId, role, status, percentage } = req.body || {};
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    const isChair = isProgramChairRole(actorRole);
    const isQa = isQaReviewRole(actorRole);
    if (!isAdmin && !isChair && !isQa) {
      return res.status(403).json({ error: "Not authorized to check tasks" });
    }

    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (await isFolderWithinLockedCopc(folder._id)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }
    if (!isAdmin) {
      const assignedList = isChair
        ? folder?.folderAssignments?.programChairs || []
        : folder?.folderAssignments?.qaOfficers || [];
      if (assignedList.length === 0) {
        return res.status(403).json({ error: "No reviewer assignment found for this folder scope" });
      }
      if (!isUserAssignedTo(userId, assignedList)) {
        return res.status(403).json({ error: "Not assigned to this folder scope" });
      }
    }

    const task = findTaskById(folder.complianceTasks || [], req.params.taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (status) task.status = status;
    if (typeof percentage !== "undefined") task.percentage = Number(percentage) || 0;
    if (status === "complete" && typeof percentage === "undefined") task.percentage = 100;

    await folder.save();
    const { normalized, progress } = computeTaskProgress(folder.complianceTasks || []);
    res.json({ success: true, tasks: normalized, progress });
  } catch (err) {
    res.status(500).json({ error: "Failed to check task" });
  }
});

// Save folder-level compliance review by program chair / QA
app.post("/folders/:id/reviews", async (req, res) => {
  try {
    const { userId, role, scope, checks, notes } = req.body || {};
    const reviewerRole = await resolveActorRole(userId, role);
    const isAdmin = reviewerRole === "superadmin";
    const isChair = isProgramChairRole(reviewerRole);
    const isQa = isQaReviewRole(reviewerRole);
    if (!isAdmin && !isChair && !isQa) {
      return res.status(403).json({ error: "Not authorized to submit review" });
    }
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (await isFolderWithinLockedCopc(folder._id)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }
    if (!isAdmin) {
      const assignedList = isChair
        ? folder?.folderAssignments?.programChairs || []
        : folder?.folderAssignments?.qaOfficers || [];
      if (assignedList.length === 0) {
        return res.status(403).json({ error: "No reviewer assignment found for this folder scope" });
      }
      if (!isUserAssignedTo(userId, assignedList)) {
        return res.status(403).json({ error: "Not assigned to this folder scope" });
      }
    }

    folder.complianceReviews = folder.complianceReviews || [];
    folder.complianceReviews.push({
      reviewer: userId,
      role: reviewerRole,
      scope: String(scope || ""),
      checks: Array.isArray(checks) ? checks : [],
      notes: String(notes || ""),
      createdAt: new Date(),
    });
    await folder.save();
    res.json({ success: true, reviews: folder.complianceReviews });
  } catch (err) {
    res.status(500).json({ error: "Failed to save review" });
  }
});

// Compliance dashboard summary (COPC)
app.get("/compliance/dashboard", async (req, res) => {
  try {
    const { userId, role, profile = "COPC_BSIT" } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !isProgramChairRole(actorRole) && !isQaReviewRole(actorRole)) {
      return res.status(403).json({ error: "Not authorized to view compliance dashboard" });
    }

    const folders = await Folder.find({
      deletedAt: null,
      $or: [
        { complianceProfileKey: profile },
        { name: new RegExp(String(profile).replace("_", " "), "i") },
      ],
    }).select("name complianceTasks");

    const categories = [
      { key: "faculty", label: "Faculty Documents" },
      { key: "curriculum", label: "Curriculum" },
      { key: "facilities", label: "Facilities" },
      { key: "library", label: "Library" },
      { key: "program", label: "Program Profile" },
      { key: "administration", label: "Administration" },
      { key: "supporting", label: "Supporting Documents" },
    ];

    const map = {};
    for (const c of categories) {
      map[c.label] = { label: c.label, total: 0, nodes: 0 };
    }

    for (const folder of folders) {
      const lowName = String(folder.name || "").toLowerCase();
      const { normalized } = computeTaskProgress(folder.complianceTasks || []);
      let picked = categories.find((c) => lowName.includes(c.key));
      if (!picked) picked = categories.find((c) => normalized.some((t) => String(t.scope || "").toLowerCase().includes(c.key)));
      if (!picked) continue;
      const bucket = map[picked.label];
      const { progress, totalNodes } = computeTaskProgress(normalized);
      bucket.total += progress;
      bucket.nodes += totalNodes > 0 ? 1 : 0;
    }

    const summary = Object.values(map)
      .filter((r) => r.nodes > 0)
      .map((row) => ({
        label: row.label,
        percent: Number((row.total / row.nodes).toFixed(2)),
      }));

    res.json({
      profile,
      status: "BSIT COPC Status",
      summary,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch compliance dashboard" });
  }
});

// Initialize COPC program workspace and standardized structure
app.post("/copc/programs/init", async (req, res) => {
  try {
    const {
      userId,
      role,
      programCode,
      programName,
      departmentName,
      year,
      deptChairIds = [],
      qaAdminIds = [],
      evaluatorIds = [],
      uploaderIds = [],
      facultyUserIds = [],
    } = req.body || {};

    const actorRole = await resolveActorRole(userId, role);
    if (actorRole !== "superadmin") {
      return res.status(403).json({ error: "Only super admin can initialize COPC programs" });
    }
    if (!programCode || !programName || !departmentName || !year) {
      return res.status(400).json({ error: "programCode, programName, departmentName, and year are required" });
    }

    const rootFolderName = "COPC";
    let copcRoot = await Folder.findOne({
      name: rootFolderName,
      parentFolder: null,
      owner: userId,
      deletedAt: null,
    });
    if (!copcRoot) {
      copcRoot = await Folder.create({
        name: rootFolderName,
        owner: userId,
        parentFolder: null,
        permissions: "owner",
        sharedWith: [],
      });
    }

    const cleanIds = (arr) =>
      Array.from(
        new Set(
          (Array.isArray(arr) ? arr : [])
            .map((entry) => entry?._id?.toString?.() || entry?.toString?.())
            .filter(Boolean)
        )
      );

    const programKey = `COPC_${String(programCode).trim().toUpperCase()}`;
    const existing = await Folder.findOne({
      parentFolder: copcRoot._id,
      "copc.isProgramRoot": true,
      "copc.programCode": String(programCode).trim().toUpperCase(),
      "copc.year": Number(year),
      deletedAt: null,
    });
    if (existing) {
      return res.status(409).json({ error: "COPC program workspace already exists for this code and year", folderId: existing._id });
    }

    const baseAssignments = {
      uploaders: cleanIds(uploaderIds),
      programChairs: cleanIds(deptChairIds),
      qaOfficers: cleanIds(qaAdminIds),
      evaluators: cleanIds(evaluatorIds),
    };

    const programFolder = await Folder.create({
      name: String(programCode).trim().toUpperCase(),
      owner: userId,
      parentFolder: copcRoot._id,
      permissions: "owner",
      sharedWith: [],
      complianceProfileKey: programKey,
      folderAssignments: baseAssignments,
      copc: {
        isProgramRoot: true,
        programCode: String(programCode).trim().toUpperCase(),
        programName: String(programName).trim(),
        departmentName: String(departmentName).trim(),
        year: Number(year),
        workflowStage: "collecting_documents",
        workflowStatus: "Collecting Documents",
      },
    });

    const createdFolders = [programFolder];
    let facultyCredentialsFolder = null;
    for (const sectionName of COPC_DEFAULT_STRUCTURE) {
      const taskTitles = COPC_DEFAULT_TASKS[sectionName] || [];
      const tasks = taskTitles.map((title) =>
        normalizeTaskNode({
          title,
          status: "not_started",
          percentage: 0,
          scope: sectionName,
          checks: ["complete", "updated", "aligned with CHED standards"],
        })
      );
      const section = await Folder.create({
        name: sectionName,
        owner: userId,
        parentFolder: programFolder._id,
        permissions: "owner",
        sharedWith: [],
        complianceProfileKey: programKey,
        folderAssignments: baseAssignments,
        complianceTasks: tasks,
      });
      createdFolders.push(section);
      if (sectionName.toLowerCase().includes("faculty")) facultyCredentialsFolder = section;
    }

    if (facultyCredentialsFolder) {
      const facultyIds = cleanIds(facultyUserIds);
      for (const facultyId of facultyIds) {
        const facultyUser = await UserModel.findById(facultyId).select("email");
        if (!facultyUser) continue;
        const folderName = String(facultyUser.email || `faculty-${facultyId}`).split("@")[0];
        const facultyFolder = await Folder.create({
          name: folderName,
          owner: userId,
          parentFolder: facultyCredentialsFolder._id,
          permissions: "owner",
          sharedWith: [],
          complianceProfileKey: programKey,
          folderAssignments: {
            uploaders: [facultyId],
            programChairs: baseAssignments.programChairs,
            qaOfficers: baseAssignments.qaOfficers,
            evaluators: baseAssignments.evaluators,
          },
          complianceTasks: (COPC_DEFAULT_TASKS["03 Faculty Credentials"] || []).map((title) =>
            normalizeTaskNode({
              title,
              status: "not_started",
              percentage: 0,
              scope: "03 Faculty Credentials",
              checks: ["complete", "updated", "aligned with CHED standards"],
            })
          ),
        });
        createdFolders.push(facultyFolder);
      }
    }

    createLog("COPC_INIT_PROGRAM", userId, `Initialized ${programName} (${programCode}) COPC workflow`);
    res.json({
      success: true,
      programFolderId: programFolder._id,
      rootFolderId: copcRoot._id,
      createdCount: createdFolders.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to initialize COPC program workflow" });
  }
});

// List COPC program roots visible to user
app.get("/copc/programs", async (req, res) => {
  try {
    const { userId, role } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    const roots = await Folder.find({
      deletedAt: null,
      "copc.isProgramRoot": true,
    })
      .select("name copc complianceProfileKey owner folderAssignments")
      .sort({ createdAt: -1 });

    const visible = [];
    for (const folder of roots) {
      if (actorRole === "superadmin") {
        visible.push(folder);
        continue;
      }
      const canView = await canUserAccessCopcProgram(folder, userId, actorRole);
      if (canView) visible.push(folder);
    }

    res.json(
      visible.map((folder) => {
        const rawStage = String(folder?.copc?.workflowStage || "initialized");
        const workflowStage = rawStage === "submitted" ? "copc_ready" : rawStage;
        const workflowStatus = rawStage === "submitted" ? "COPC Ready" : (folder?.copc?.workflowStatus || "In Progress");
        return {
          _id: folder._id,
          name: folder.name,
          profileKey: folder.complianceProfileKey || null,
          programCode: folder?.copc?.programCode || "",
          programName: folder?.copc?.programName || folder.name,
          departmentName: folder?.copc?.departmentName || "",
          year: folder?.copc?.year || null,
          workflowStage,
          workflowStatus,
          isLocked: !!folder?.copc?.locked?.isLocked,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to list COPC programs" });
  }
});

// Detailed COPC workflow state for one program
app.get("/copc/programs/:id/workflow", async (req, res) => {
  try {
    const { userId, role } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    const root = await Folder.findById(req.params.id).select("name copc complianceProfileKey folderAssignments owner");
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !(await canUserAccessCopcProgram(root, userId, actorRole))) {
      return res.status(403).json({ error: "Not authorized to view this COPC workflow" });
    }

    const folderIds = await getDescendantFolderIds(root._id);
    const folders = await Folder.find({ _id: { $in: folderIds }, deletedAt: null }).select("name complianceTasks");
    const files = await File.find({ parentFolder: { $in: folderIds }, deletedAt: null }).select("reviewWorkflow parentFolder");

    const counts = {
      submitted: 0,
      pendingProgramChair: 0,
      pendingQa: 0,
      rejected: 0,
      approved: 0,
      verified: 0,
    };
    for (const file of files) {
      const wf = file.reviewWorkflow || {};
      counts.submitted += 1;
      if (wf.status === "pending_program_chair") counts.pendingProgramChair += 1;
      if (wf.status === "pending_qa") counts.pendingQa += 1;
      if (wf.status === "rejected_program_chair" || wf.status === "rejected_qa") counts.rejected += 1;
      if (wf.status === "approved") counts.approved += 1;
      if (wf?.verificationBadge?.verified) counts.verified += 1;
    }

    const bucketKeywords = [
      { label: "Faculty Documents", keys: ["faculty"] },
      { label: "Curriculum", keys: ["curriculum"] },
      { label: "Facilities", keys: ["facilities"] },
      { label: "Library Resources", keys: ["library"] },
      { label: "Program Profile", keys: ["program profile"] },
      { label: "Administration", keys: ["administration"] },
      { label: "Supporting Documents", keys: ["supporting"] },
    ];
    const summaryMap = {};
    bucketKeywords.forEach((b) => (summaryMap[b.label] = { total: 0, nodes: 0 }));
    for (const folder of folders) {
      const low = String(folder.name || "").toLowerCase();
      const picked = bucketKeywords.find((b) => b.keys.some((k) => low.includes(k)));
      if (!picked) continue;
      const { progress, totalNodes } = computeTaskProgress(folder.complianceTasks || []);
      summaryMap[picked.label].total += progress;
      if (totalNodes > 0) summaryMap[picked.label].nodes += 1;
    }
    const summary = Object.entries(summaryMap).map(([label, value]) => ({
      label,
      percent: value.nodes > 0 ? Number((value.total / value.nodes).toFixed(2)) : 0,
    }));
    const overallCompliance = summary.length
      ? Number((summary.reduce((acc, item) => acc + item.percent, 0) / summary.length).toFixed(2))
      : 0;
    const finalApprovalChecklist = {
      finalDocumentVerification:
        counts.submitted > 0 && counts.approved === counts.submitted,
      systemAuditReview:
        counts.pendingProgramChair === 0 &&
        counts.pendingQa === 0 &&
        counts.rejected === 0,
      lockApprovedDocuments: !!root?.copc?.locked?.isLocked,
      generateFinalCopcSubmissionFile: !!String(root?.copc?.packageMeta?.fileName || "").trim(),
    };

    const rawStage = String(root?.copc?.workflowStage || "initialized");
    const workflowStage = rawStage === "submitted" ? "copc_ready" : rawStage;
    const workflowStatus = rawStage === "submitted" ? "COPC Ready" : (root?.copc?.workflowStatus || "In Progress");

    const workflowSteps = [
      { key: "initialized", label: "System Initialization" },
      { key: "collecting_documents", label: "Document Upload" },
      { key: "department_review", label: "Department Review" },
      { key: "qa_verification", label: "Compliance Verification" },
      { key: "internal_evaluation", label: "Internal Evaluation" },
      { key: "package_compiled", label: "COPC Package Compilation" },
      { key: "copc_ready", label: "Final Approval" },
      { key: "archived", label: "Archive" },
    ];
    const currentIndex = workflowSteps.findIndex((step) => step.key === workflowStage);
    const steps = workflowSteps.map((step, index) => ({
      ...step,
      complete: index <= currentIndex,
      current: index === currentIndex,
    }));

    res.json({
      program: {
        _id: root._id,
        code: root?.copc?.programCode || root.name,
        name: root?.copc?.programName || root.name,
        department: root?.copc?.departmentName || "",
        year: root?.copc?.year || null,
        stage: workflowStage,
        status: workflowStatus,
        isLocked: !!root?.copc?.locked?.isLocked,
        packageMeta: root?.copc?.packageMeta || {},
        submissionMeta: root?.copc?.submissionMeta || {},
        archiveMeta: root?.copc?.archiveMeta || {},
        assignments: {
          uploaders: Array.isArray(root?.folderAssignments?.uploaders) ? root.folderAssignments.uploaders : [],
          programChairs: Array.isArray(root?.folderAssignments?.programChairs) ? root.folderAssignments.programChairs : [],
          qaOfficers: Array.isArray(root?.folderAssignments?.qaOfficers) ? root.folderAssignments.qaOfficers : [],
          evaluators: Array.isArray(root?.folderAssignments?.evaluators) ? root.folderAssignments.evaluators : [],
        },
      },
      observations: Array.isArray(root?.copc?.observations) ? root.copc.observations : [],
      counts,
      summary,
      overallCompliance,
      finalApprovalChecklist,
      steps,
      actions: {
        canCompile: ["superadmin", "qa_admin"].includes(actorRole),
        canFinalApprove: actorRole === "superadmin",
        canArchive: ["superadmin", "qa_admin"].includes(actorRole),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch COPC workflow details" });
  }
});

// Department chair review queue for a selected COPC program
app.get("/copc/programs/:id/department-chair/submissions", async (req, res) => {
  try {
    const { userId, role, status = "pending" } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !isProgramChairRole(actorRole)) {
      return res.status(403).json({ error: "Only super admin or department chair can access this review queue" });
    }

    const root = await Folder.findById(req.params.id).select("name copc complianceProfileKey folderAssignments owner");
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    if (!isAdmin && !(await canUserAccessCopcProgram(root, userId, actorRole))) {
      return res.status(403).json({ error: "Not authorized to review this COPC program" });
    }

    const folderIds = await getDescendantFolderIds(root._id);
    const files = await File.find({
      parentFolder: { $in: folderIds },
      deletedAt: null,
    })
      .select("originalName filename mimetype size uploadDate parentFolder reviewWorkflow classification")
      .populate("parentFolder", "name");

    const normalizedStatus = String(status || "pending").toLowerCase();
    const submissions = files
      .filter((file) => {
        const wf = file?.reviewWorkflow || {};
        if (!wf?.requiresReview) return false;
        if (!wf?.programChair || wf.programChair.status === "not_required") return false;

        const assigned = Array.isArray(wf.assignedProgramChairs) ? wf.assignedProgramChairs : [];
        if (!isAdmin && !isUserAssignedTo(userId, assigned)) return false;

        const chairStatus = String(wf?.programChair?.status || "");
        if (normalizedStatus === "all") return true;
        if (normalizedStatus === "pending") return chairStatus === "pending";
        if (normalizedStatus === "completed") return chairStatus === "approved" || chairStatus === "rejected";
        if (normalizedStatus === "revision") return String(wf?.status || "") === "rejected_program_chair";
        return chairStatus === "pending";
      })
      .map((file) => {
        const wf = file?.reviewWorkflow || {};
        return {
          _id: file._id,
          originalName: file.originalName,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          uploadDate: file.uploadDate,
          folderName: file?.parentFolder?.name || "Unknown Folder",
          status: wf?.status || "pending_program_chair",
          programChairStatus: wf?.programChair?.status || "pending",
          programChairNotes: wf?.programChair?.notes || "",
          classification: file?.classification || null,
        };
      })
      .sort((a, b) => new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime());

    const counts = {
      pending: submissions.filter((s) => s.programChairStatus === "pending").length,
      approved: submissions.filter((s) => s.programChairStatus === "approved").length,
      rejected: submissions.filter((s) => s.programChairStatus === "rejected").length,
    };

    res.json({
      program: {
        _id: root._id,
        code: root?.copc?.programCode || root.name,
        name: root?.copc?.programName || root.name,
        department: root?.copc?.departmentName || "",
        year: root?.copc?.year || null,
      },
      counts,
      submissions,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load department chair submissions" });
  }
});

// QA admin compliance review queue for a selected COPC program
app.get("/copc/programs/:id/qa/submissions", async (req, res) => {
  try {
    const { userId, role, status = "pending" } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !isQaReviewRole(actorRole)) {
      return res.status(403).json({ error: "Only super admin or QA admin can access this review queue" });
    }

    const root = await Folder.findById(req.params.id).select("name copc complianceProfileKey folderAssignments owner");
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    if (!isAdmin && !(await canUserAccessCopcProgram(root, userId, actorRole))) {
      return res.status(403).json({ error: "Not authorized to review this COPC program" });
    }

    const folderIds = await getDescendantFolderIds(root._id);
    const files = await File.find({
      parentFolder: { $in: folderIds },
      deletedAt: null,
    })
      .select("originalName filename mimetype size uploadDate parentFolder reviewWorkflow classification")
      .populate("parentFolder", "name");

    const normalizedStatus = String(status || "pending").toLowerCase();
    const queue = files
      .filter((file) => {
        const wf = file?.reviewWorkflow || {};
        if (!wf?.requiresReview) return false;
        if (!wf?.qaOfficer || wf.qaOfficer.status === "not_required") return false;
        if (wf?.programChair && wf.programChair.status === "pending") return false;

        const assigned = Array.isArray(wf.assignedQaOfficers) ? wf.assignedQaOfficers : [];
        if (!isAdmin && !isUserAssignedTo(userId, assigned)) return false;
        return true;
      })
      .map((file) => {
        const wf = file?.reviewWorkflow || {};
        return {
          _id: file._id,
          originalName: file.originalName,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          uploadDate: file.uploadDate,
          folderName: file?.parentFolder?.name || "Unknown Folder",
          status: wf?.status || "pending_qa",
          programChairStatus: wf?.programChair?.status || "not_required",
          programChairNotes: wf?.programChair?.notes || "",
          qaStatus: wf?.qaOfficer?.status || "pending",
          qaNotes: wf?.qaOfficer?.notes || "",
          classification: file?.classification || null,
        };
      });

    const submissions = queue
      .filter((item) => {
        const qaStatus = String(item.qaStatus || "");
        const wfStatus = String(item.status || "");
        if (normalizedStatus === "all") return true;
        if (normalizedStatus === "pending") return qaStatus === "pending" || wfStatus === "pending_qa";
        if (normalizedStatus === "completed") return qaStatus === "approved" || qaStatus === "rejected";
        if (normalizedStatus === "revision") return wfStatus === "rejected_qa";
        return qaStatus === "pending" || wfStatus === "pending_qa";
      })
      .sort((a, b) => new Date(b.uploadDate || 0).getTime() - new Date(a.uploadDate || 0).getTime());

    const counts = {
      pending: queue.filter((s) => s.qaStatus === "pending" || s.status === "pending_qa").length,
      approved: queue.filter((s) => s.qaStatus === "approved").length,
      rejected: queue.filter((s) => s.qaStatus === "rejected").length,
    };

    res.json({
      program: {
        _id: root._id,
        code: root?.copc?.programCode || root.name,
        name: root?.copc?.programName || root.name,
        department: root?.copc?.departmentName || "",
        year: root?.copc?.year || null,
      },
      counts,
      submissions,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load QA admin submissions" });
  }
});

// QA compilation view: approved files grouped by COPC folder structure
app.get("/copc/programs/:id/compilation/approved-tree", async (req, res) => {
  try {
    const { userId, role } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !isQaReviewRole(actorRole) && !isReadOnlyReviewerRole(actorRole)) {
      return res.status(403).json({ error: "Only super admin, QA admin, or evaluator can access COPC compilation view" });
    }

    const root = await Folder.findById(req.params.id).select("name copc folderAssignments owner");
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    if (!isAdmin && !(await canUserAccessCopcProgram(root, userId, actorRole))) {
      return res.status(403).json({ error: "Not authorized to access this COPC program" });
    }

    const folderIds = await getDescendantFolderIds(root._id);
    const folders = await Folder.find({ _id: { $in: folderIds }, deletedAt: null })
      .select("_id name parentFolder")
      .sort({ name: 1 });
    const folderMap = new Map(folders.map((folder) => [String(folder._id), folder]));

    const buildFolderPath = (folderId) => {
      const parts = [];
      let cursor = folderMap.get(String(folderId));
      let guard = 0;
      while (cursor && guard < 120) {
        guard += 1;
        if (String(cursor._id) === String(root._id)) break;
        parts.unshift(String(cursor.name || ""));
        if (!cursor.parentFolder) break;
        cursor = folderMap.get(String(cursor.parentFolder));
      }
      return parts.join("/");
    };

    const rawFiles = await File.find({
      parentFolder: { $in: folderIds },
      deletedAt: null,
    }).select("originalName filename size mimetype uploadDate parentFolder reviewWorkflow");

    const approvedFiles = rawFiles
      .filter((file) => isFileFullyApprovedForCopc(file))
      .map((file) => ({
        _id: file._id,
        originalName: file.originalName,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        uploadDate: file.uploadDate,
        parentFolder: file.parentFolder,
        folderPath: buildFolderPath(file.parentFolder),
      }));

    const grouped = new Map();
    approvedFiles.forEach((file) => {
      const pathKey = String(file.folderPath || "");
      if (!grouped.has(pathKey)) grouped.set(pathKey, []);
      grouped.get(pathKey).push(file);
    });

    const foldersWithFiles = Array.from(grouped.entries())
      .map(([folderPath, filesInFolder]) => ({
        folderPath,
        files: filesInFolder
          .slice()
          .sort((a, b) => String(a.originalName || "").localeCompare(String(b.originalName || ""))),
      }))
      .sort((a, b) => String(a.folderPath || "").localeCompare(String(b.folderPath || "")));

    res.json({
      program: {
        _id: root._id,
        code: root?.copc?.programCode || root.name,
        name: root?.copc?.programName || root.name,
        year: root?.copc?.year || null,
        packageFileName: `COPC_${root?.copc?.programCode || root.name}_${root?.copc?.year || new Date().getFullYear()}.zip`,
        packageRootFolder: `COPC_${root?.copc?.programCode || root.name}`,
      },
      counts: {
        approvedFiles: approvedFiles.length,
        foldersWithApprovedFiles: foldersWithFiles.length,
      },
      folders: foldersWithFiles,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load COPC compilation tree" });
  }
});

// Evaluator report download (read-only compliance dashboard snapshot)
app.get("/copc/programs/:id/evaluation/report/download", async (req, res) => {
  try {
    const { userId, role } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !isReadOnlyReviewerRole(actorRole) && !isQaReviewRole(actorRole)) {
      return res.status(403).json({ error: "Only super admin, QA admin, or evaluator can download evaluation report" });
    }

    const root = await Folder.findById(req.params.id).select("name copc complianceProfileKey folderAssignments owner");
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    if (!isAdmin && !(await canUserAccessCopcProgram(root, userId, actorRole))) {
      return res.status(403).json({ error: "Not authorized to access this COPC program" });
    }

    const folderIds = await getDescendantFolderIds(root._id);
    const folders = await Folder.find({ _id: { $in: folderIds }, deletedAt: null }).select("_id name parentFolder complianceTasks");
    const files = await File.find({ parentFolder: { $in: folderIds }, deletedAt: null })
      .select("originalName uploadDate parentFolder reviewWorkflow");
    const folderMap = new Map(folders.map((folder) => [String(folder._id), folder]));

    const buildFolderPath = (folderId) => {
      const parts = [];
      let cursor = folderMap.get(String(folderId));
      let guard = 0;
      while (cursor && guard < 120) {
        guard += 1;
        if (String(cursor._id) === String(root._id)) break;
        parts.unshift(String(cursor.name || ""));
        if (!cursor.parentFolder) break;
        cursor = folderMap.get(String(cursor.parentFolder));
      }
      return parts.join("/");
    };

    const counts = {
      submitted: 0,
      pendingProgramChair: 0,
      pendingQa: 0,
      rejected: 0,
      approved: 0,
      verified: 0,
    };
    for (const file of files) {
      const wf = file.reviewWorkflow || {};
      counts.submitted += 1;
      if (wf.status === "pending_program_chair") counts.pendingProgramChair += 1;
      if (wf.status === "pending_qa") counts.pendingQa += 1;
      if (wf.status === "rejected_program_chair" || wf.status === "rejected_qa") counts.rejected += 1;
      if (wf.status === "approved") counts.approved += 1;
      if (wf?.verificationBadge?.verified) counts.verified += 1;
    }

    const bucketKeywords = [
      { label: "Faculty Documents", keys: ["faculty"] },
      { label: "Curriculum", keys: ["curriculum"] },
      { label: "Facilities", keys: ["facilities"] },
      { label: "Library Resources", keys: ["library"] },
      { label: "Program Profile", keys: ["program profile"] },
      { label: "Administration", keys: ["administration"] },
      { label: "Supporting Documents", keys: ["supporting"] },
    ];
    const summaryMap = {};
    bucketKeywords.forEach((bucket) => {
      summaryMap[bucket.label] = { total: 0, nodes: 0 };
    });
    for (const folder of folders) {
      const low = String(folder.name || "").toLowerCase();
      const picked = bucketKeywords.find((bucket) => bucket.keys.some((key) => low.includes(key)));
      if (!picked) continue;
      const { progress, totalNodes } = computeTaskProgress(folder.complianceTasks || []);
      summaryMap[picked.label].total += progress;
      if (totalNodes > 0) summaryMap[picked.label].nodes += 1;
    }
    const summary = Object.entries(summaryMap).map(([label, value]) => ({
      label,
      percent: value.nodes > 0 ? Number((value.total / value.nodes).toFixed(2)) : 0,
    }));
    const overallCompliance = summary.length
      ? Number((summary.reduce((acc, item) => acc + item.percent, 0) / summary.length).toFixed(2))
      : 0;

    const verifiedDocuments = files
      .filter((file) => isFileFullyApprovedForCopc(file))
      .map((file) => ({
        folderPath: buildFolderPath(file.parentFolder),
        originalName: file.originalName,
        uploadedAt: file.uploadDate,
      }))
      .sort((a, b) => String(a.folderPath || "").localeCompare(String(b.folderPath || "")) || String(a.originalName || "").localeCompare(String(b.originalName || "")));

    const escapeCsv = (value) => {
      const raw = String(value ?? "");
      if (raw.includes(",") || raw.includes("\"") || raw.includes("\n")) {
        return `"${raw.replace(/"/g, "\"\"")}"`;
      }
      return raw;
    };

    const lines = [];
    lines.push("Section,Metric,Value");
    lines.push(`Program,Code,${escapeCsv(root?.copc?.programCode || root.name)}`);
    lines.push(`Program,Name,${escapeCsv(root?.copc?.programName || root.name)}`);
    lines.push(`Program,Department,${escapeCsv(root?.copc?.departmentName || "")}`);
    lines.push(`Program,Academic Year,${escapeCsv(root?.copc?.year || "")}`);
    lines.push(`Program,Workflow Stage,${escapeCsv(root?.copc?.workflowStage || "initialized")}`);
    lines.push(`Program,Workflow Status,${escapeCsv(root?.copc?.workflowStatus || "In Progress")}`);
    lines.push(`Program,Generated At,${escapeCsv(new Date().toISOString())}`);

    lines.push(`Counts,Submitted Documents,${counts.submitted}`);
    lines.push(`Counts,Pending Department Review,${counts.pendingProgramChair}`);
    lines.push(`Counts,Pending QA Review,${counts.pendingQa}`);
    lines.push(`Counts,Rejected For Revision,${counts.rejected}`);
    lines.push(`Counts,Approved Documents,${counts.approved}`);
    lines.push(`Counts,Verified Badge Count,${counts.verified}`);
    lines.push(`Counts,Overall Compliance Percent,${overallCompliance}`);

    summary.forEach((item) => {
      lines.push(`Compliance Summary,${escapeCsv(item.label)},${item.percent}`);
    });

    if (verifiedDocuments.length) {
      lines.push("Verified Documents,Folder Path,Document Name,Uploaded At");
      verifiedDocuments.forEach((item) => {
        lines.push(`Verified Documents,${escapeCsv(item.folderPath || "Root")},${escapeCsv(item.originalName || "")},${escapeCsv(item.uploadedAt ? new Date(item.uploadedAt).toISOString() : "")}`);
      });
    }

    const fileName = `COPC_${root?.copc?.programCode || root.name}_${root?.copc?.year || new Date().getFullYear()}_evaluation_report.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(lines.join("\n"));
  } catch (err) {
    res.status(500).json({ error: "Failed to download evaluation report" });
  }
});

// Faculty uploader status tracker for selected COPC program/folder
app.get("/copc/programs/:id/my-upload-status", async (req, res) => {
  try {
    const { userId, role, folderId, status = "all" } = req.query || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const actorRole = await resolveActorRole(userId, role);
    const root = await Folder.findById(req.params.id).select("name copc complianceProfileKey folderAssignments owner");
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }

    if (actorRole !== "superadmin" && !(await canUserAccessCopcProgram(root, userId, actorRole))) {
      return res.status(403).json({ error: "Not authorized to view this COPC program" });
    }

    const descendantIds = await getDescendantFolderIds(root._id);
    const descendantSet = new Set(descendantIds.map((id) => String(id)));
    const scopedFolderId = folderId ? String(folderId) : "";
    if (scopedFolderId && !descendantSet.has(scopedFolderId)) {
      return res.status(400).json({ error: "Selected folder is outside the COPC program scope" });
    }

    const query = {
      deletedAt: null,
      userId: String(userId),
      parentFolder: scopedFolderId
        ? scopedFolderId
        : { $in: descendantIds },
    };

    const rawFiles = await File.find(query)
      .select("originalName filename mimetype size uploadDate parentFolder reviewWorkflow classification")
      .populate("parentFolder", "name")
      .sort({ uploadDate: -1 });

    const normalizedStatus = String(status || "all").toLowerCase();
    const mappedRows = rawFiles
      .map((file) => {
        const wf = file.reviewWorkflow || {};
        const workflowStatus = wf.requiresReview ? (wf.status || "pending_program_chair") : "approved";
        return {
          _id: file._id,
          originalName: file.originalName,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          uploadDate: file.uploadDate,
          folderId: file?.parentFolder?._id || file?.parentFolder || null,
          folderName: file?.parentFolder?.name || "Unknown Folder",
          workflowStatus,
          programChairStatus: wf?.programChair?.status || "not_required",
          programChairNotes: wf?.programChair?.notes || "",
          qaStatus: wf?.qaOfficer?.status || "not_required",
          qaNotes: wf?.qaOfficer?.notes || "",
          classification: file?.classification || null,
        };
      });

    const rows = mappedRows.filter((row) => {
      if (normalizedStatus === "all") return true;
      return String(row.workflowStatus || "").toLowerCase() === normalizedStatus;
    });

    const counts = {
      total: mappedRows.length,
      approved: mappedRows.filter((r) => r.workflowStatus === "approved").length,
      pendingProgramChair: mappedRows.filter((r) => r.workflowStatus === "pending_program_chair").length,
      pendingQa: mappedRows.filter((r) => r.workflowStatus === "pending_qa").length,
      rejectedProgramChair: mappedRows.filter((r) => r.workflowStatus === "rejected_program_chair").length,
      rejectedQa: mappedRows.filter((r) => r.workflowStatus === "rejected_qa").length,
    };

    res.json({
      program: {
        _id: root._id,
        code: root?.copc?.programCode || root.name,
        name: root?.copc?.programName || root.name,
        year: root?.copc?.year || null,
      },
      folderId: scopedFolderId || null,
      counts,
      files: rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load upload status tracker" });
  }
});

// List folders under a COPC program scope with upload eligibility
app.get("/copc/programs/:id/folders", async (req, res) => {
  try {
    const { userId, role } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    const root = await Folder.findById(req.params.id).select("name copc complianceProfileKey folderAssignments owner");
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    const isAdmin = actorRole === "superadmin";
    if (!isAdmin && !(await canUserAccessCopcProgram(root, userId, actorRole))) {
      return res.status(403).json({ error: "Not authorized to view this COPC workflow" });
    }

    const folderIds = await getDescendantFolderIds(root._id);
    const folders = await Folder.find({ _id: { $in: folderIds }, deletedAt: null })
      .select("name parentFolder owner folderAssignments complianceTasks complianceProfileKey")
      .sort({ name: 1 });

    const rows = folders.map((folder) => ({
      _id: folder._id,
      name: folder.name,
      parentFolder: folder.parentFolder || null,
      canUpload: !root?.copc?.locked?.isLocked && canUploadToFolder(folder, userId, actorRole),
      isProgramRoot: String(folder._id) === String(root._id),
      taskCount: Array.isArray(folder.complianceTasks) ? folder.complianceTasks.length : 0,
    }));

    res.json({
      program: {
        _id: root._id,
        code: root?.copc?.programCode || root.name,
        name: root?.copc?.programName || root.name,
        year: root?.copc?.year || null,
        isLocked: !!root?.copc?.locked?.isLocked,
      },
      folders: rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to list COPC folders" });
  }
});

// Update COPC program role assignments (superadmin)
app.patch("/copc/programs/:id/assignments", async (req, res) => {
  try {
    const { userId, role, assignments } = req.body || {};
    const actorRole = await resolveActorRole(userId, role);
    if (actorRole !== "superadmin") {
      return res.status(403).json({ error: "Only super admin can update COPC assignments" });
    }
    const root = await Folder.findById(req.params.id);
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    if (root?.copc?.locked?.isLocked) {
      return res.status(423).json({ error: "This COPC program is locked after final approval" });
    }
    if (!assignments || typeof assignments !== "object") {
      return res.status(400).json({ error: "Assignments payload is required" });
    }

    const previousAssignments = {
      uploaders: [...(root.folderAssignments?.uploaders || [])],
      programChairs: [...(root.folderAssignments?.programChairs || [])],
      qaOfficers: [...(root.folderAssignments?.qaOfficers || [])],
      evaluators: [...(root.folderAssignments?.evaluators || [])],
    };

    const clean = (value) =>
      Array.from(
        new Set(
          (Array.isArray(value) ? value : [])
            .map((entry) => entry?._id?.toString?.() || entry?.toString?.())
            .filter(Boolean)
        )
      );

    const next = {
      uploaders: clean(assignments.uploaders),
      programChairs: clean(assignments.programChairs),
      qaOfficers: clean(assignments.qaOfficers),
      evaluators: clean(assignments.evaluators),
    };

    root.folderAssignments = next;
    await root.save();

    // Apply same base assignment set to descendants so role visibility is consistent.
    const descendantIds = await getDescendantFolderIds(root._id);
    await Folder.updateMany(
      { _id: { $in: descendantIds.filter((id) => String(id) !== String(root._id)) } },
      {
        $set: {
          "folderAssignments.uploaders": next.uploaders,
          "folderAssignments.programChairs": next.programChairs,
          "folderAssignments.qaOfficers": next.qaOfficers,
          "folderAssignments.evaluators": next.evaluators,
        },
      }
    );

    createLog("COPC_ASSIGNMENTS_UPDATE", userId, `Updated COPC assignments for ${root.name}`);

    const newUploaders = diffNotificationRecipients(next.uploaders, previousAssignments.uploaders);
    const newProgramChairs = diffNotificationRecipients(next.programChairs, previousAssignments.programChairs);
    const newQaOfficers = diffNotificationRecipients(next.qaOfficers, previousAssignments.qaOfficers);
    const newEvaluators = diffNotificationRecipients(next.evaluators, previousAssignments.evaluators);

    await createNotificationsForUsers(
      newUploaders,
      "ACTION_REQUIRED",
      "Assigned to COPC uploads",
      `You were assigned as an uploader for COPC program "${root.copc?.programCode || root.name}".`,
      root.copc?.programName || root.name,
      root._id,
      "Folder",
      { actorId: userId, metadata: { groupName: root.copc?.programCode || root.name } }
    );
    await createNotificationsForUsers(
      newProgramChairs,
      "ACTION_REQUIRED",
      "Assigned to COPC department review",
      `You were assigned as a department chair reviewer for COPC program "${root.copc?.programCode || root.name}".`,
      root.copc?.programName || root.name,
      root._id,
      "Folder",
      { actorId: userId, metadata: { groupName: root.copc?.programCode || root.name } }
    );
    await createNotificationsForUsers(
      newQaOfficers,
      "ACTION_REQUIRED",
      "Assigned to COPC QA review",
      `You were assigned as a QA reviewer for COPC program "${root.copc?.programCode || root.name}".`,
      root.copc?.programName || root.name,
      root._id,
      "Folder",
      { actorId: userId, metadata: { groupName: root.copc?.programCode || root.name } }
    );
    await createNotificationsForUsers(
      newEvaluators,
      "ACTION_REQUIRED",
      "Assigned to COPC evaluation",
      `You were assigned as an evaluator for COPC program "${root.copc?.programCode || root.name}".`,
      root.copc?.programName || root.name,
      root._id,
      "Folder",
      { actorId: userId, metadata: { groupName: root.copc?.programCode || root.name } }
    );

    res.json({ success: true, assignments: next });
  } catch (err) {
    res.status(500).json({ error: "Failed to update COPC assignments" });
  }
});

// Delete COPC program scope (superadmin, soft delete)
app.delete("/copc/programs/:id", async (req, res) => {
  try {
    const { userId, role } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    if (actorRole !== "superadmin") {
      return res.status(403).json({ error: "Only super admin can delete COPC programs" });
    }

    const root = await Folder.findById(req.params.id).select("name copc");
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }

    const deletedIds = await softDeleteFolderTree(root._id, new Date());
    createLog(
      "COPC_PROGRAM_DELETE",
      userId,
      `Deleted COPC program ${root?.copc?.programCode || root.name} (${deletedIds.length} folders/files scoped)`
    );
    res.json({ success: true, deletedCount: deletedIds.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete COPC program" });
  }
});

// Evaluator observations during internal evaluation
app.post("/copc/programs/:id/observations", async (req, res) => {
  try {
    const { userId, role, message } = req.body || {};
    const actorRole = await resolveActorRole(userId, role);
    if (!["evaluator", "qa_admin", "superadmin"].includes(actorRole)) {
      return res.status(403).json({ error: "Only evaluator/QA/super admin can add observations" });
    }
    if (!String(message || "").trim()) {
      return res.status(400).json({ error: "Observation message is required" });
    }
    const root = await Folder.findById(req.params.id);
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    if (!(await canUserAccessCopcProgram(root, userId, actorRole)) && actorRole !== "superadmin") {
      return res.status(403).json({ error: "Not authorized for this workflow scope" });
    }
    root.copc.observations = Array.isArray(root.copc.observations) ? root.copc.observations : [];
    root.copc.observations.push({
      by: userId,
      role: actorRole,
      message: String(message || "").trim(),
      createdAt: new Date(),
    });
    root.copc.workflowStage = "internal_evaluation";
    root.copc.workflowStatus = "Internal Evaluation";
    await root.save();
    createLog("COPC_OBSERVATION", userId, `Added evaluator observation for ${root.name}`);

    await createNotificationsForUsers(
      await getCopcStakeholderIds(root),
      "COPC_OBSERVATION",
      "New COPC observation",
      `A new observation was added for COPC program "${root.copc?.programCode || root.name}".`,
      String(message || "").trim(),
      root._id,
      "Folder",
      {
        actorId: userId,
        metadata: {
          groupName: root.copc?.programCode || root.name,
        },
      }
    );

    res.json({ success: true, observations: root.copc.observations });
  } catch (err) {
    res.status(500).json({ error: "Failed to add observation" });
  }
});

// Workflow actions: compile package, final approval, archive
app.post("/copc/programs/:id/actions", async (req, res) => {
  try {
    const { userId, role, action } = req.body || {};
    const actorRole = await resolveActorRole(userId, role);
    const root = await Folder.findById(req.params.id);
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    if (!(await canUserAccessCopcProgram(root, userId, actorRole)) && actorRole !== "superadmin") {
      return res.status(403).json({ error: "Not authorized for this workflow scope" });
    }

    const normalizedAction = String(action || "").toLowerCase();
    const now = new Date();
    if (normalizedAction === "compile_package") {
      if (!["superadmin", "qa_admin"].includes(actorRole)) {
        return res.status(403).json({ error: "Only super admin or QA admin can compile package" });
      }
      const folderIds = await getDescendantFolderIds(root._id);
      const candidateFiles = await File.find({
        parentFolder: { $in: folderIds },
        deletedAt: null,
      }).select("reviewWorkflow");
      const approvedFileCount = candidateFiles.filter((file) => isFileFullyApprovedForCopc(file)).length;
      if (approvedFileCount === 0) {
        return res.status(400).json({
          error: "No fully approved files found. Approve documents in both Department Chair and QA stages first.",
        });
      }
      root.copc.workflowStage = "package_compiled";
      root.copc.workflowStatus = "Package Compiled";
      root.copc.packageMeta = {
        fileName: `COPC_${root?.copc?.programCode || root.name}_${root?.copc?.year || new Date().getFullYear()}.zip`,
        generatedAt: now,
        generatedBy: userId || null,
        approvedFileCount,
      };
    } else if (normalizedAction === "final_approval") {
      if (actorRole !== "superadmin") {
        return res.status(403).json({ error: "Only super admin can perform final approval" });
      }
      const folderIds = await getDescendantFolderIds(root._id);
      const files = await File.find({
        parentFolder: { $in: folderIds },
        deletedAt: null,
      }).select("reviewWorkflow");

      const audit = {
        totalDocuments: files.length,
        approvedDocuments: 0,
        pendingDepartmentReview: 0,
        pendingQaReview: 0,
        rejectedForRevision: 0,
      };
      for (const file of files) {
        const status = String(file?.reviewWorkflow?.status || "");
        if (status === "approved") audit.approvedDocuments += 1;
        if (status === "pending_program_chair") audit.pendingDepartmentReview += 1;
        if (status === "pending_qa") audit.pendingQaReview += 1;
        if (status === "rejected_program_chair" || status === "rejected_qa") audit.rejectedForRevision += 1;
      }

      const finalReady =
        audit.totalDocuments > 0 &&
        audit.pendingDepartmentReview === 0 &&
        audit.pendingQaReview === 0 &&
        audit.rejectedForRevision === 0 &&
        audit.approvedDocuments === audit.totalDocuments;
      if (!finalReady) {
        return res.status(400).json({
          error: "Final approval blocked. Complete final document verification and system audit review first.",
          audit,
        });
      }

      root.copc.workflowStage = "copc_ready";
      root.copc.workflowStatus = "COPC Ready";
      root.copc.packageMeta = {
        fileName: `COPC_${root?.copc?.programCode || root.name}_${root?.copc?.year || new Date().getFullYear()}.zip`,
        generatedAt: now,
        generatedBy: userId || null,
      };
      root.copc.locked = {
        isLocked: true,
        lockedAt: now,
        lockedBy: userId || null,
      };
    } else if (normalizedAction === "archive") {
      if (!["superadmin", "qa_admin"].includes(actorRole)) {
        return res.status(403).json({ error: "Only super admin or QA admin can archive documents" });
      }
      root.copc.workflowStage = "archived";
      root.copc.workflowStatus = "Archived";
      root.copc.archiveMeta = {
        archiveYear: Number(root?.copc?.year || new Date().getFullYear()),
        archivedAt: now,
      };
    } else {
      return res.status(400).json({ error: "Unknown workflow action" });
    }

    await root.save();
    createLog("COPC_WORKFLOW_ACTION", userId, `${normalizedAction} for ${root?.copc?.programCode || root.name}`);

    await createNotificationsForUsers(
      await getCopcStakeholderIds(root),
      "COPC_WORKFLOW_ACTION",
      "COPC workflow updated",
      `The COPC workflow for "${root?.copc?.programCode || root.name}" moved to "${root.copc.workflowStatus}".`,
      normalizedAction,
      root._id,
      "Folder",
      {
        actorId: userId,
        metadata: {
          groupName: root?.copc?.programCode || root.name,
          action: normalizedAction,
          status: root.copc.workflowStatus,
        },
      }
    );

    res.json({ success: true, stage: root.copc.workflowStage, status: root.copc.workflowStatus, copc: root.copc });
  } catch (err) {
    res.status(500).json({ error: "Failed to update COPC workflow action" });
  }
});

// Download compiled COPC package as zip
app.get("/copc/programs/:id/package/download", async (req, res) => {
  try {
    const { userId, role } = req.query || {};
    const actorRole = await resolveActorRole(userId, role);
    const root = await Folder.findById(req.params.id);
    if (!root || !root?.copc?.isProgramRoot) {
      return res.status(404).json({ error: "COPC program root not found" });
    }
    if (!(await canUserAccessCopcProgram(root, userId, actorRole)) && actorRole !== "superadmin") {
      return res.status(403).json({ error: "Not authorized to download this package" });
    }
    if (!["superadmin", "qa_admin", "dept_chair", "evaluator"].includes(actorRole)) {
      return res.status(403).json({ error: "Role is not allowed to download COPC package" });
    }

    const folderIds = await getDescendantFolderIds(root._id);
    const files = await File.find({
      parentFolder: { $in: folderIds },
      deletedAt: null,
    }).select("filename originalName parentFolder reviewWorkflow");
    const folderMap = new Map();
    const allFolders = await Folder.find({ _id: { $in: folderIds } }).select("_id name parentFolder");
    allFolders.forEach((f) => folderMap.set(String(f._id), f));

    const buildFolderPath = (folderId) => {
      const parts = [];
      let cursor = folderMap.get(String(folderId));
      while (cursor) {
        if (String(cursor._id) === String(root._id)) break;
        parts.unshift(cursor.name);
        if (!cursor.parentFolder) break;
        cursor = folderMap.get(String(cursor.parentFolder));
      }
      return parts.join("/");
    };

    const fileName = root?.copc?.packageMeta?.fileName || `COPC_${root?.copc?.programCode || root.name}_${root?.copc?.year || new Date().getFullYear()}.zip`;
    const packageRootFolder = `COPC_${root?.copc?.programCode || root.name}`;
    const approvedFiles = files.filter((file) => isFileFullyApprovedForCopc(file));
    if (!approvedFiles.length) {
      return res.status(400).json({
        error: "No fully approved files available for COPC package download.",
      });
    }
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", () => res.status(500).end());
    archive.pipe(res);

    for (const file of approvedFiles) {
      const diskPath = path.join(__dirname, "uploads", file.filename);
      if (!fs.existsSync(diskPath)) continue;
      const rel = buildFolderPath(file.parentFolder);
      const targetPath = rel
        ? `${packageRootFolder}/${rel}/${file.originalName}`
        : `${packageRootFolder}/${file.originalName}`;
      archive.file(diskPath, { name: targetPath });
    }
    await archive.finalize();
  } catch (err) {
    res.status(500).json({ error: "Failed to download COPC package" });
  }
});

// Request missing document from faculty/user
app.post("/folders/:id/document-requests", async (req, res) => {
  try {
    const { userId, role, targetUserId, documentName, deadline, message } = req.body || {};
    const isAdmin = await isAdminContext(role, userId);
    if (!isAdmin && !isProgramChairRole(role) && !isQaReviewRole(role)) {
      return res.status(403).json({ error: "Not authorized to request documents" });
    }
    if (!targetUserId || !documentName) {
      return res.status(400).json({ error: "targetUserId and documentName are required" });
    }
    const folder = await Folder.findById(req.params.id).select("name");
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const dueText = deadline ? `Deadline: ${new Date(deadline).toLocaleDateString()}` : "";
    const details = `${documentName}${dueText ? ` | ${dueText}` : ""}`;
    await createNotification(
      targetUserId,
      "DOCUMENT_REQUEST",
      "Document request",
      message || `Please upload "${documentName}" for "${folder.name}".`,
      details,
      folder._id,
      "Folder",
      {
        actorId: userId,
        metadata: {
          folderName: folder.name,
          documentName,
          deadline: deadline || null,
        },
      }
    );
    await updateCopcStage(folder._id, "revision", "Revision Requested");
    createLog("DOCUMENT_REQUEST", userId, `Requested ${documentName} from ${targetUserId}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to create document request" });
  }
});

// List pending document requests for current user
app.get("/document-requests", async (req, res) => {
  try {
    const { userId } = req.query || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const requests = await Notification.find({
      userId,
      type: "DOCUMENT_REQUEST",
      isRead: false,
    }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch document requests" });
  }
});

// Folder completeness checker for required docs
app.post("/folders/:id/completeness", async (req, res) => {
  try {
    const { requiredDocuments = [] } = req.body || {};
    const folder = await Folder.findById(req.params.id).select("_id name");
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const files = await File.find({ parentFolder: folder._id, deletedAt: null }).select("originalName");
    const names = files.map((f) => String(f.originalName || "").toLowerCase());
    const rows = requiredDocuments.map((doc) => {
      const key = String(doc || "").toLowerCase();
      const exists = names.some((n) => n.includes(key));
      return { name: doc, exists };
    });
    const completeCount = rows.filter((r) => r.exists).length;
    const percent = rows.length ? Number(((completeCount / rows.length) * 100).toFixed(2)) : 0;
    res.json({ folderId: folder._id, requirements: rows, percent });
  } catch (err) {
    res.status(500).json({ error: "Failed to check completeness" });
  }
});

// QA verification badge toggle for a file
app.patch("/files/:id/verify", async (req, res) => {
  try {
    const { userId, role, verified } = req.body || {};
    const isAdmin = await isAdminContext(role, userId);
    if (!isAdmin && !isQaReviewRole(role)) {
      return res.status(403).json({ error: "Only QA/Admin can verify documents" });
    }
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });
    file.reviewWorkflow = file.reviewWorkflow || {};
    file.reviewWorkflow.verificationBadge = {
      verified: !!verified,
      verifiedBy: verified ? userId : null,
      verifiedAt: verified ? new Date() : null,
      label: verified ? "Verified by QA Office" : "Pending Verification",
    };
    await file.save();
    res.json({ success: true, reviewWorkflow: file.reviewWorkflow });
  } catch (err) {
    res.status(500).json({ error: "Failed to update verification badge" });
  }
});

// Get folder versions
app.get("/folders/:id/versions", async (req, res) => {
  try {
    const versions = await FolderVersion.find({ folderId: req.params.id })
      .populate("createdBy", "email")
      .sort({ versionNumber: -1 });
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch folder versions" });
  }
});

// Restore folder to a specific version (creates a new version)
app.post("/folders/:id/versions/:versionId/restore", async (req, res) => {
  try {
    const { userId, role } = req.body || {};
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (await isFolderWithinLockedCopc(folder._id)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }

    const isAdmin = canEditAnyDocuments(role);
    const ownerId = folder.owner?.toString?.() || folder.owner;
    if (!isAdmin && (!userId || ownerId.toString() !== userId.toString())) {
      return res.status(403).json({ error: "Not authorized to restore versions" });
    }

    const version = await FolderVersion.findById(req.params.versionId);
    if (!version || version.folderId.toString() !== folder._id.toString()) {
      return res.status(404).json({ error: "Version not found" });
    }

    const latestVersion = await FolderVersion.findOne({ folderId: folder._id })
      .sort({ versionNumber: -1 });
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await FolderVersion.updateMany({ folderId: folder._id }, { isCurrent: false });

    const previousName = folder.name;
    folder.name = version.name;
    await folder.save();

    const restoredVersion = await FolderVersion.create({
      folderId: folder._id,
      versionNumber: nextVersionNumber,
      name: version.name,
      createdBy: userId || folder.owner,
      changeDescription: `Restored to version ${version.versionNumber}`,
      changes: { type: "restore", from: previousName, to: version.name },
      isCurrent: true
    });

    createLog("RESTORE_FOLDER_VERSION", userId || folder.owner, `Restored folder ${folder.name} to version ${version.versionNumber}`);

    res.json({ success: true, folder, version: restoredVersion });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore folder version" });
  }
});

// Share folder
app.patch("/folders/:id/share", async (req, res) => {
  try {
    const { emails, permission, userId, role } = req.body;
    const users = await UserModel.find({ email: { $in: emails } });
    if (!users.length)
      return res.status(404).json({ error: "No matching users found" });

    const userIds = users.map((u) => u._id);
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (await isFolderWithinLockedCopc(folder._id)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }

    const ownerId = folder.owner?.toString?.() || folder.owner;
    const isOwner = !!userId && ownerId?.toString() === userId.toString();
    const isAdmin = await isAdminContext(role, userId);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to share this folder" });
    }

    const nextShared = new Set(
      (folder.sharedWith || []).map((id) => id?.toString?.() || id)
    );
    userIds.forEach((id) => nextShared.add(id?.toString?.() || id));
    folder.sharedWith = Array.from(nextShared);
    if (permission) folder.permissions = normalizePermissionRole(permission, "viewer");

    await folder.save();
    await folder.populate("sharedWith", "email");

    // NEW: log folder share
    createLog("SHARE_FOLDER", folder.owner, `Shared folder ${folder.name} with ${emails.join(", ")}`);

    await createNotificationsForUsers(
      userIds,
      "SHARE_FOLDER",
      "Folder shared with you",
      `"${folder.name}" has been shared with you.`,
      `Permission: ${folder.permissions}`,
      folder._id,
      "Folder",
      {
        actorId: userId,
        metadata: {
          folderName: folder.name,
          permission: folder.permissions,
        },
      }
    );

    res.json({ status: "success", folder });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Unshare folder (remove user from sharedWith)
app.patch("/folders/:id/unshare", async (req, res) => {
  try {
    const { userId, actorId, role } = req.body;
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const ownerId = folder.owner?.toString?.() || folder.owner;
    const isOwner = !!actorId && ownerId?.toString() === actorId.toString();
    const isAdmin = await isAdminContext(role, actorId);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to unshare this folder" });
    }

    folder.sharedWith = folder.sharedWith.filter(id => id.toString() !== userId.toString());
    await folder.save();
    await folder.populate("sharedWith", "email");

    // NEW: log unshare
    createLog("UNSHARE_FOLDER", folder.owner, `Removed access from folder ${folder.name}`);

    res.json({ status: "success", folder });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

/* ========================
   NAVIGATION / SHARED
======================== */
app.get("/breadcrumbs", async (req, res) => {
  try {
    const { folderId } = req.query;
    if (!folderId) return res.json([]);

    let breadcrumbs = [];
    let current = await Folder.findById(folderId);

    while (current) {
      breadcrumbs.unshift({ _id: current._id, name: current.name });
      if (!current.parentFolder) break;
      current = await Folder.findById(current.parentFolder);
    }

    res.json(breadcrumbs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/shared", async (req, res) => {
  try {
    const { userId, folderId, sortBy, sortOrder } = req.query;
    let folders, files;

    // Sorting options
    let fileSortOptions = {};
    let folderSortOptions = {};
    if (sortBy === "name") {
      fileSortOptions.originalName = sortOrder === "desc" ? -1 : 1;
      folderSortOptions.name = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "date") {
      fileSortOptions.uploadDate = sortOrder === "desc" ? -1 : 1;
      folderSortOptions.createdAt = sortOrder === "desc" ? -1 : 1;
    } else {
      fileSortOptions.uploadDate = -1;
      folderSortOptions.createdAt = -1;
    }

    if (folderId) {
      const currentFolder = await Folder.findOne({ _id: folderId }).populate("owner", "email");
      if (!currentFolder) return res.status(404).json({ error: "Folder not found" });

      // Check if user has access to this folder (owner or in sharedWith)
      const hasAccess = currentFolder.owner._id.toString() === userId ||
                       currentFolder.sharedWith.some(sharedId => sharedId.toString() === userId);

      if (!hasAccess) {
        return res.status(403).json({ error: "No access to this folder" });
      }

      folders = await Folder.find({ parentFolder: folderId, deletedAt: null })
        .populate("owner", "email")
        .sort(folderSortOptions)
        .lean();
      files = await File.find({ parentFolder: folderId, deletedAt: null })
        .populate("owner", "email")
        .sort(fileSortOptions)
        .lean();
    } else {
      folders = await Folder.find({ sharedWith: userId, deletedAt: null })
        .populate("owner", "email")
        .sort(folderSortOptions)
        .lean();
      files = await File.find({ sharedWith: userId, parentFolder: null, deletedAt: null })
        .populate("owner", "email")
        .sort(fileSortOptions)
        .lean();
    }

    // Add ownerEmail for convenience and ensure permissions field is included
    folders = folders.map(f => ({ ...f, ownerEmail: f.owner?.email || null }));
    files = files.map(f => ({
      ...f,
      ownerEmail: f.owner?.email || null,
      permissions: f.permissions || "owner",
      isDuplicate: !!f.duplicateOf,
      classification: f.classification || null,
      isFavorite: isFlaggedByUser(f.favoritedBy, userId),
      isPinned: isFlaggedByUser(f.pinnedBy, userId),
    }));

    res.json({ folders, files });
  } catch (err) {
    console.error("Shared fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/shared/groups", async (req, res) => {
  try {
    const { userId, sortBy, sortOrder } = req.query;

    // Validate input
    if (!userId) {
      console.error("Missing userId in /shared/groups request");
      return res.status(400).json({ error: "Missing userId" });
    }

    console.log(`Fetching group shares for user: ${userId}`);

    // Sorting options
    let fileSortOptions = {};
    let folderSortOptions = {};
    if (sortBy === "name") {
      fileSortOptions.originalName = sortOrder === "desc" ? -1 : 1;
      folderSortOptions.name = sortOrder === "desc" ? -1 : 1;
    } else if (sortBy === "date") {
      fileSortOptions.uploadDate = sortOrder === "desc" ? -1 : 1;
      folderSortOptions.createdAt = sortOrder === "desc" ? -1 : 1;
    } else {
      fileSortOptions.uploadDate = -1;
      folderSortOptions.createdAt = -1;
    }

    // Get groups where user is a member
    let userGroups;
    try {
      userGroups = await Group.find({ members: userId }).select('_id name sharedFiles sharedFolders leaders');
      console.log(`Found ${userGroups.length} groups for user`);
    } catch (groupErr) {
      console.error("Error fetching user groups:", groupErr);
      return res.status(500).json({ error: "Failed to fetch user groups" });
    }

    if (!userGroups.length) {
      console.log("No groups found for user");
      return res.json({ folders: [], files: [] });
    }

    // Get all shared files from these groups
    let sharedFiles = [];
    let sharedFolders = [];

    for (const group of userGroups) {
      console.log(`Processing group: ${group.name} (${group._id})`);
      const isLeader = group.leaders?.some(id => id.toString() === userId);

      try {
        // Safely access sharedFiles array
        const sharedFilesArray = Array.isArray(group.sharedFiles) ? group.sharedFiles : [];
        console.log(`Group has ${sharedFilesArray.length} shared files`);

        if (sharedFilesArray.length > 0) {
          for (const sharedFile of sharedFilesArray) {
            try {
              console.log(`Fetching shared file: ${sharedFile.fileId}`);
              const file = await File.findById(sharedFile.fileId)
                .populate("owner", "email")
                .lean();

              if (file && !file.deletedAt) {
                sharedFiles.push({
                  ...file,
                  groupId: group._id,
                  groupName: group.name,
                  permission: normalizePermissionRole(sharedFile.permission, "viewer"),
                  sharedBy: sharedFile.sharedBy,
                  sharedAt: sharedFile.sharedAt,
                  isGroupLeader: isLeader
                });
              } else {
                console.log(`File ${sharedFile.fileId} not found or deleted`);
              }
            } catch (fileErr) {
              console.error(`Error fetching shared file ${sharedFile.fileId}:`, fileErr.message);
              continue; // Skip this file but continue processing others
            }
          }
        }

        // Safely access sharedFolders array
        const sharedFoldersArray = Array.isArray(group.sharedFolders) ? group.sharedFolders : [];
        console.log(`Group has ${sharedFoldersArray.length} shared folders`);

        if (sharedFoldersArray.length > 0) {
          for (const sharedFolder of sharedFoldersArray) {
            try {
              console.log(`Fetching shared folder: ${sharedFolder.folderId}`);
              const folder = await Folder.findById(sharedFolder.folderId)
                .populate("owner", "email")
                .lean();

              if (folder && !folder.deletedAt) {
                sharedFolders.push({
                  ...folder,
                  groupId: group._id,
                  groupName: group.name,
                  permission: normalizePermissionRole(sharedFolder.permission, "viewer"),
                  sharedBy: sharedFolder.sharedBy,
                  sharedAt: sharedFolder.sharedAt,
                  isGroupLeader: isLeader
                });
              } else {
                console.log(`Folder ${sharedFolder.folderId} not found or deleted`);
              }
            } catch (folderErr) {
              console.error(`Error fetching shared folder ${sharedFolder.folderId}:`, folderErr.message);
              continue; // Skip this folder but continue processing others
            }
          }
        }
      } catch (groupErr) {
        console.error(`Error processing group ${group._id}:`, groupErr.message);
        continue;
      }
    }

    console.log(`Total shared files: ${sharedFiles.length}, shared folders: ${sharedFolders.length}`);

    // Sort the results
    try {
      sharedFiles.sort((a, b) => {
        if (sortBy === "name") {
          return sortOrder === "desc"
            ? (b.originalName || "").localeCompare(a.originalName || "")
            : (a.originalName || "").localeCompare(b.originalName || "");
        }
        return sortOrder === "desc"
          ? new Date(b.uploadDate) - new Date(a.uploadDate)
          : new Date(a.uploadDate) - new Date(b.uploadDate);
      });

      sharedFolders.sort((a, b) => {
        if (sortBy === "name") {
          return sortOrder === "desc"
            ? (b.name || "").localeCompare(a.name || "")
            : (a.name || "").localeCompare(b.name || "");
        }
        return sortOrder === "desc"
          ? new Date(b.createdAt) - new Date(a.createdAt)
          : new Date(a.createdAt) - new Date(b.createdAt);
      });
    } catch (sortErr) {
      console.error("Error sorting results:", sortErr.message);
      // Continue without sorting if there's an error
    }

    // Add ownerEmail for convenience
    sharedFolders = sharedFolders.map(f => ({ ...f, ownerEmail: f.owner?.email || null }));
    sharedFiles = sharedFiles.map(f => ({
      ...f,
      ownerEmail: f.owner?.email || null,
      permissions: normalizePermissionRole(f.permission, "viewer"),
      isDuplicate: !!f.duplicateOf,
      classification: f.classification || null,
      isFavorite: isFlaggedByUser(f.favoritedBy, userId),
      isPinned: isFlaggedByUser(f.pinnedBy, userId),
    }));

    console.log("Successfully returning group shared content");
    res.json({ folders: sharedFolders, files: sharedFiles });
  } catch (err) {
    console.error("Group shared fetch error:", err);
    res.status(500).json({ error: `Failed to fetch group shares: ${err.message}` });
  }
});

/* ========================
   SEARCH
======================== */
const parseCsvList = (value) =>
  String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const parseBoolean = (value) => String(value || "").toLowerCase() === "true";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveDateRange = ({ datePreset, dateFrom, dateTo }) => {
  const now = new Date();
  if (datePreset === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end };
  }
  if (datePreset === "7d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { $gte: start, $lte: now };
  }
  if (datePreset === "30d") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { $gte: start, $lte: now };
  }

  const range = {};
  if (dateFrom) range.$gte = new Date(dateFrom);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return Object.keys(range).length ? range : null;
};

const buildMimeRegex = (fileTypes = []) => {
  if (!fileTypes.length) return null;
  const matcher = fileTypes
    .map((type) => String(type || "").toLowerCase())
    .filter(Boolean)
    .map((type) => {
      switch (type) {
        case "pdf":
          return "pdf";
        case "doc":
        case "docx":
        case "word":
          return "(word|doc|officedocument\\.wordprocessingml)";
        case "xls":
        case "xlsx":
        case "excel":
          return "(excel|sheet|spreadsheet)";
        case "image":
          return "image/";
        case "video":
          return "video/";
        case "archive":
          return "(zip|rar|7z|tar|gzip)";
        case "text":
          return "(text/|json|xml|csv)";
        default:
          return escapeRegex(type);
      }
    });

  if (!matcher.length) return null;
  return new RegExp(matcher.join("|"), "i");
};

app.get("/search", async (req, res) => {
  try {
    const {
      userId,
      query,
      q,
      limit,
      entityTypes,
      type,
      fileTypes,
      datePreset,
      dateFrom,
      dateTo,
      date,
      scope = "both",
      sortBy = "relevance",
      sortOrder = "desc",
      favoritesOnly,
      pinnedOnly,
      sharedOnly,
      duplicatesOnly,
      exactMatch,
    } = req.query;

    const searchTerm = (query || q || "").trim();

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const limitNum = Math.max(5, Math.min(parseInt(limit || "20", 10) || 20, 100));
    const includeTypes = new Set(parseCsvList(entityTypes || type || "file,folder"));
    const includeFiles = includeTypes.has("file");
    const includeFolders = includeTypes.has("folder");
    const includeName = scope !== "content";
    const includeContent = scope === "content" || scope === "both";
    const hasSearchTerm = searchTerm.length > 0;
    const useExactMatch = parseBoolean(exactMatch);
    const dateRange = resolveDateRange({
      datePreset,
      dateFrom: dateFrom || date,
      dateTo,
    });
    const mimeRegex = buildMimeRegex(parseCsvList(fileTypes));

    const fileBaseQuery = {
      deletedAt: null,
      $or: [{ owner: userId }, { userId }, { sharedWith: userId }],
    };
    if (mimeRegex) fileBaseQuery.mimetype = mimeRegex;
    if (dateRange) fileBaseQuery.uploadDate = dateRange;
    if (parseBoolean(favoritesOnly)) fileBaseQuery.favoritedBy = userId;
    if (parseBoolean(pinnedOnly)) fileBaseQuery.pinnedBy = userId;
    if (parseBoolean(duplicatesOnly)) fileBaseQuery.duplicateOf = { $ne: null };
    if (parseBoolean(sharedOnly)) {
      fileBaseQuery.sharedWith = userId;
      fileBaseQuery.owner = { $ne: userId };
    }

    const folderBaseQuery = {
      deletedAt: null,
      $or: [{ owner: userId }, { sharedWith: userId }],
    };
    if (dateRange) folderBaseQuery.createdAt = dateRange;
    if (parseBoolean(sharedOnly)) {
      folderBaseQuery.sharedWith = userId;
      folderBaseQuery.owner = { $ne: userId };
    }

    const termRegex = useExactMatch
      ? new RegExp(`^${escapeRegex(searchTerm)}$`, "i")
      : new RegExp(escapeRegex(searchTerm), "i");

    const filesByName =
      includeFiles && includeName && hasSearchTerm
        ? await File.find({
            ...fileBaseQuery,
            originalName: termRegex,
          }).populate("owner", "email")
        : [];

    const allFiles =
      includeFiles && (includeContent || !hasSearchTerm)
        ? await File.find(fileBaseQuery).populate("owner", "email").limit(limitNum * 5)
        : [];
    const filesWithContent = [];
    const searchLower = searchTerm.toLowerCase();

    for (const file of allFiles) {
      if (!hasSearchTerm && !includeName) continue;
      if (!hasSearchTerm && includeName) continue;
      // Skip files already found by name
      if (filesByName.some(f => f._id.toString() === file._id.toString())) {
        continue;
      }

      // Only search inside text-based files or supported document types
      const textMimeTypes = [
        "text/",
        "application/json",
        "application/javascript",
        "application/xml",
        "application/x-sh",
        "application/x-bat",
        "application/x-csv",
      ];

      const isTextFile = textMimeTypes.some(mime => file.mimetype?.startsWith(mime));
      const isPdf = file.mimetype?.includes("pdf");
      const isDocx = file.mimetype?.includes("vnd.openxmlformats-officedocument.wordprocessingml.document") ||
                     (file.originalName && file.originalName.toLowerCase().endsWith(".docx"));
      const isXlsx = file.mimetype?.includes("spreadsheetml") ||
                     file.mimetype?.includes("vnd.ms-excel") ||
                     (file.originalName && (file.originalName.toLowerCase().endsWith(".xlsx") || file.originalName.toLowerCase().endsWith(".xls")));

      if (includeContent && hasSearchTerm && isTextFile) {
        try {
          const filePath = path.join(__dirname, "uploads", file.filename);

          // Check if file exists and is not too large (limit to 10MB for search)
          if (fs.existsSync(filePath) && file.size < 10 * 1024 * 1024) {
            // Read text file content
            const fileContent = fs.readFileSync(filePath, "utf8").toLowerCase();

            // Search for the term in file content
            if (fileContent.includes(searchLower)) {
              filesWithContent.push(file);
            }
          }
        } catch (readErr) {
          // If file read fails, skip it
          console.error(`Error reading file ${file.filename} for search:`, readErr.message);
          continue;
        }
      } else if (includeContent && hasSearchTerm && (isPdf || isDocx || isXlsx) && file.size < 15 * 1024 * 1024) {
        try {
          const filePath = path.join(__dirname, "uploads", file.filename);
          if (!fs.existsSync(filePath)) continue;

          if (isPdf) {
            try {
              const pdfParse = require("pdf-parse");
              const dataBuffer = fs.readFileSync(filePath);
              const parsed = await pdfParse(dataBuffer);
              const text = (parsed.text || "").toLowerCase();
              if (text.includes(searchLower)) {
                filesWithContent.push(file);
              }
            } catch (pdfErr) {
              console.error(`PDF parse failed for ${file.filename}:`, pdfErr.message);
            }
          }

          if (isDocx) {
            try {
              const mammoth = require("mammoth");
              const result = await mammoth.extractRawText({ path: filePath });
              const text = (result.value || "").toLowerCase();
              if (text.includes(searchLower)) {
                filesWithContent.push(file);
              }
            } catch (docxErr) {
              console.error(`DOCX parse failed for ${file.filename}:`, docxErr.message);
            }
          }

          if (isXlsx) {
            try {
              const XLSX = require("xlsx");
              const workbook = XLSX.readFile(filePath, { cellHTML: false, cellText: true });
              let combined = "";
              for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                if (csv) combined += " " + csv.toLowerCase();
              }
              if (combined.includes(searchLower)) {
                filesWithContent.push(file);
              }
            } catch (xlsxErr) {
              console.error(`XLSX parse failed for ${file.filename}:`, xlsxErr.message);
            }
          }
        } catch (docErr) {
          console.error(`Content extraction error for ${file.filename}:`, docErr.message);
          continue;
        }
      }
    }

    const foldersByName =
      includeFolders && hasSearchTerm && includeName
        ? await Folder.find({
            ...folderBaseQuery,
            name: termRegex,
          }).populate("owner", "email")
        : [];

    const foldersByFilterOnly =
      includeFolders && !hasSearchTerm
        ? await Folder.find(folderBaseQuery)
            .populate("owner", "email")
            .sort({ createdAt: -1 })
            .limit(limitNum * 3)
        : [];

    const filesByFilterOnly =
      includeFiles && !hasSearchTerm
        ? await File.find(fileBaseQuery)
            .populate("owner", "email")
            .sort({ uploadDate: -1 })
            .limit(limitNum * 3)
        : [];

    // Combine files and folders
    const allFilesResult = [...filesByName, ...filesWithContent, ...filesByFilterOnly];
    const allFoldersResult = [...foldersByName, ...foldersByFilterOnly];

    // Remove duplicates
    const uniqueFiles = [];
    const seenFileIds = new Set();
    for (const file of allFilesResult) {
      if (!seenFileIds.has(file._id.toString())) {
        seenFileIds.add(file._id.toString());
        uniqueFiles.push(file);
      }
    }

    const uniqueFolders = [];
    const seenFolderIds = new Set();
    for (const folder of allFoldersResult) {
      if (!seenFolderIds.has(folder._id.toString())) {
        seenFolderIds.add(folder._id.toString());
        uniqueFolders.push(folder);
      }
    }

    const results = [
      ...uniqueFolders.map((folder) => ({ ...folder.toObject(), isFolder: true, type: "folder" })),
      ...uniqueFiles.map((file) => ({
        ...file.toObject(),
        isFile: true,
        type: "file",
        isFavorite: isFlaggedByUser(file.favoritedBy, userId),
        isPinned: isFlaggedByUser(file.pinnedBy, userId),
      })),
    ];

    const scoreResult = (item) => {
      if (!hasSearchTerm) return 0;
      const target = (item.originalName || item.name || "").toLowerCase();
      if (target === searchLower) return 100;
      if (target.startsWith(searchLower)) return 70;
      if (target.includes(searchLower)) return 50;
      if (item.matchedBy === "content") return 35;
      return 10;
    };

    results.sort((a, b) => {
      const direction = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "name") {
        return direction * (a.originalName || a.name || "").localeCompare(b.originalName || b.name || "");
      }
      if (sortBy === "size") {
        return direction * ((a.size || 0) - (b.size || 0));
      }
      if (sortBy === "date" || !hasSearchTerm || sortBy === "recent") {
        const dateA = new Date(a.uploadDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.uploadDate || b.createdAt || 0).getTime();
        return direction * (dateA - dateB);
      }
      const scoreDelta = scoreResult(b) - scoreResult(a);
      if (scoreDelta !== 0) return scoreDelta;
      const dateA = new Date(a.uploadDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.uploadDate || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    res.json(results.slice(0, limitNum));
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Failed to search files and folders" });
  }
});

/* ========================
   TRASH MANAGEMENT
======================== */
app.get("/trash", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    let fileQuery = { deletedAt: { $ne: null } };
    let folderQuery = { deletedAt: { $ne: null } };

    if (!canDeleteDocuments(actorRole)) {
      fileQuery.userId = userId;
      folderQuery.owner = userId;
    }

    const files = await File.find(fileQuery).sort({ deletedAt: -1 });
    const folders = await Folder.find(folderQuery).sort({ deletedAt: -1 });

    res.json({ files, folders });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch trash" });
  }
});

// Restore file
app.patch("/trash/files/:id/restore", async (req, res) => {
  try {
    const { role, userId } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const isAdmin = canEditAnyDocuments(actorRole);
    const ownerId = file.owner?.toString?.() || file.userId?.toString?.() || file.owner;
    if (!isAdmin && (!userId || ownerId.toString() !== userId.toString())) {
      return res.status(403).json({ error: "Not authorized to restore file" });
    }

    let nextParent = file.parentFolder || null;
    if (nextParent) {
      const parent = await Folder.findById(nextParent);
      if (!parent || parent.deletedAt) nextParent = null;
    }

    file.deletedAt = null;
    file.parentFolder = nextParent;
    await file.save();
    await reconcileDuplicateGroup(file.contentHash);

    // NEW: log restore
    createLog("RESTORE_FILE", file.owner, `Restored ${file.originalName}`);

    res.json({ status: "restored", file });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore folder
app.patch("/trash/folders/:id/restore", async (req, res) => {
  try {
    const { role, userId } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const isAdmin = canEditAnyDocuments(actorRole);
    const ownerId = folder.owner?.toString?.() || folder.owner;
    if (!isAdmin && (!userId || ownerId.toString() !== userId.toString())) {
      return res.status(403).json({ error: "Not authorized to restore folder" });
    }

    let nextParent = folder.parentFolder || null;
    if (nextParent) {
      const parent = await Folder.findById(nextParent);
      if (!parent || parent.deletedAt) nextParent = null;
    }

    folder.deletedAt = null;
    folder.parentFolder = nextParent;
    await folder.save();
    const restoredIds = await restoreFolderTree(folder._id);

    // NEW: log restore folder
    createLog("RESTORE_FOLDER", folder.owner, `Restored folder ${folder.name}`);

    res.json({ status: "restored", folder, restoredCount: restoredIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete file (Admin only)
app.delete("/trash/files/:id", async (req, res) => {
  try {
    const { role, userId } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    if (!canDeleteDocuments(actorRole)) {
      return res.status(403).json({ error: "Only super admin or QA admin can permanently delete files" });
    }

    const file = await File.findByIdAndDelete(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    // NEW: log permanent delete
    createLog("PERMANENT_DELETE_FILE", file.owner, `Permanently deleted ${file.originalName}`);

    res.json({ status: "permanently-deleted", file });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete folder (Admin only)
app.delete("/trash/folders/:id", async (req, res) => {
  try {
    const { role, userId } = req.query;
    const actorRole = await resolveActorRole(userId, role);
    if (!canDeleteDocuments(actorRole)) {
      return res.status(403).json({ error: "Only super admin or QA admin can permanently delete folders" });
    }

    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    const ids = await getDescendantFolderIds(folder._id, { includeDeleted: true });
    await File.deleteMany({ parentFolder: { $in: ids } });
    await Folder.deleteMany({ _id: { $in: ids } });

    // NEW: log permanent delete folder
    createLog("PERMANENT_DELETE_FOLDER", folder.owner, `Permanently deleted folder ${folder.name}`);

    res.json({ status: "permanently-deleted", folder, deletedCount: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========================
   USER MANAGEMENT
======================== */

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await UserModel.find()
      .select("_id name email role active createdAt")
      .sort({ createdAt: -1 })
      .lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  try {
    const actorRole = await resolveActorRole(req.query?.userId, req.query?.role);
    if (!canManageUsers(actorRole)) {
      return res.status(403).json({ error: "Only super admin can manage users" });
    }
    const user = await UserModel.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // NEW: log user deletion
    createLog("DELETE_USER", user._id, `Deleted user ${user.email || user._id}`);

    res.json({ status: "deleted", user });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Update user role (admin, superadmin, user, etc.)
app.patch("/users/:id/role", async (req, res) => {
  try {
    const actorRole = await resolveActorRole(req.query?.userId, req.query?.role);
    if (!canManageUsers(actorRole)) {
      return res.status(403).json({ error: "Only super admin can manage users" });
    }
    const { role } = req.body;
    const allowedRoles = ["superadmin", "qa_admin", "dept_chair", "faculty", "evaluator"];
    const normalizedRole = normalizeRole(role);
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${allowedRoles.join(", ")}` });
    }
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { role: normalizedRole },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    // NEW: log role update
    createLog("UPDATE_ROLE", user._id, `Role changed to ${normalizedRole}`);

    res.json({ status: "updated", user });
  } catch (err) {
    res.status(500).json({ error: "Failed to update role" });
  }
});

//logs (NEW endpoint)
app.get("/logs", async (req, res) => {
  try {
    const logs = await Log.find()
      .populate("user", "email role")
      .sort({ timeStamp: -1, date: -1 })
      .limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// Toggle user active/inactive
app.patch("/users/:id/status", async (req, res) => {
  try {
    const actorRole = await resolveActorRole(req.query?.userId, req.query?.role);
    if (!canManageUsers(actorRole)) {
      return res.status(403).json({ error: "Only super admin can manage users" });
    }
    const { active } = req.body;
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { active },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    // NEW: log status change
    createLog("UPDATE_STATUS", user._id, `Status changed to ${active}`);

    res.json({ status: "updated", user });
  } catch (err) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

// Admin: Create single user
app.post("/admin/users", async (req, res) => {
  try {
    const actorRole = await resolveActorRole(req.query?.userId, req.query?.role);
    if (!canManageUsers(actorRole)) {
      return res.status(403).json({ error: "Only super admin can manage users" });
    }
    const { email, password, name, role } = req.body;
    const allowedRoles = ["superadmin", "qa_admin", "dept_chair", "faculty", "evaluator"];

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "User with this email already exists" });
    }

    // Validate role
    const normalizedRole = normalizeRole(role);
    if (role && !allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${allowedRoles.join(", ")}` });
    }

    // Create new user
    const newUser = new UserModel({
      email,
      password, // Will be hashed by the model
      name: name || "",
      role: normalizedRole || "faculty",
      active: true
    });

    await newUser.save();

    // Log user creation
    createLog("CREATE_USER", newUser._id, `Admin created user: ${email}`);

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser.toObject();
    res.json({ success: true, user: userWithoutPassword });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// Admin: Bulk import users
app.post("/admin/users/bulk", async (req, res) => {
  try {
    const actorRole = await resolveActorRole(req.query?.userId, req.query?.role);
    if (!canManageUsers(actorRole)) {
      return res.status(403).json({ error: "Only super admin can manage users" });
    }
    const { users } = req.body;
    const allowedRoles = ["superadmin", "qa_admin", "dept_chair", "faculty", "evaluator"];

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: "Users array is required" });
    }

    if (users.length > 1000) {
      return res.status(400).json({ error: "Maximum 1000 users can be imported at once" });
    }

    let successful = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      try {
        // Validate required fields
        if (!user.email || !user.password) {
          errors.push(`Row ${i + 1}: Email and password are required`);
          failed++;
          continue;
        }

        // Check if user already exists
        const existingUser = await UserModel.findOne({ email: user.email });
        if (existingUser) {
          errors.push(`Row ${i + 1}: User with email ${user.email} already exists`);
          failed++;
          continue;
        }

        // Validate role
        const userRole = normalizeRole(user.role || "faculty");
        if (!allowedRoles.includes(userRole)) {
          errors.push(`Row ${i + 1}: Invalid role '${userRole}'. Allowed roles: ${allowedRoles.join(", ")}`);
          failed++;
          continue;
        }

        // Create new user
        const newUser = new UserModel({
          email: user.email,
          password: user.password,
          name: user.name || "",
          role: userRole,
          active: true
        });

        await newUser.save();
        successful++;

        // Log user creation
        createLog("BULK_CREATE_USER", newUser._id, `Bulk imported user: ${user.email}`);

      } catch (userErr) {
        console.error(`Error creating user ${user.email}:`, userErr);
        errors.push(`Row ${i + 1}: ${userErr.message || "Unknown error"}`);
        failed++;
      }
    }

    res.json({
      successful,
      failed,
      total: users.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error("Bulk import error:", err);
    res.status(500).json({ error: "Bulk import failed" });
  }
});

// Get user statistics
app.get("/users/stats", async (req, res) => {
  try {
    const actorRole = await resolveActorRole(req.query?.userId, req.query?.role);
    if (!canManageUsers(actorRole)) {
      return res.status(403).json({ error: "Only super admin can manage users" });
    }
    // Basic counts - simple and accurate
    const totalUsers = await UserModel.countDocuments();

    // Count active users (active is not false)
    const activeUsers = await UserModel.countDocuments({
      $or: [
        { active: { $ne: false } },
        { active: { $exists: false } }
      ]
    });

    // Calculate inactive as total minus active
    const inactiveUsers = totalUsers - activeUsers;

    const allowedRoles = ["superadmin", "qa_admin", "dept_chair", "faculty", "evaluator"];
    const rolesCount = {};
    await Promise.all(
      allowedRoles.map(async (roleKey) => {
        rolesCount[roleKey] = await UserModel.countDocuments({ role: roleKey });
      })
    );

    // Recent registrations (last 30 days) - simplified
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsers = await UserModel.find({ createdAt: { $gte: thirtyDaysAgo } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email createdAt");

    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers,
      rolesCount,
      recentUsers: recentUsers || [],
      activeUsersList: []
    });
  } catch (err) {
    console.error("User stats error:", err);
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

app.get("/stats", async (req, res) => {
  try {
    // Basic counts
    const totalUsers = await UserModel.countDocuments();
    const totalFiles = await File.countDocuments({ deletedAt: null });
    const totalFolders = await Folder.countDocuments({ deletedAt: null });
    const activeUsers = await UserModel.countDocuments({
      $or: [
        { active: { $ne: false } },
        { active: { $exists: false } },
      ],
    });
    const inactiveUsers = totalUsers - activeUsers;

    // Storage usage
    const storageStats = await File.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          totalSize: { $sum: "$size" },
          avgFileSize: { $avg: "$size" }
        }
      }
    ]);
    const totalStorage = storageStats[0]?.totalSize || 0;
    const avgFileSize = storageStats[0]?.avgFileSize || 0;

    // File type distribution
    const fileTypes = await File.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: { $substr: ["$mimetype", 0, { $indexOfBytes: ["$mimetype", "/"] }] },
          count: { $sum: 1 },
          totalSize: { $sum: "$size" }
        }
      },
      { $sort: { count: -1 } }
    ]);
    const fileTypeData = fileTypes.map(ft => ({
      type: ft._id || "unknown",
      count: ft.count,
      size: ft.totalSize
    }));

    // User registration trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userRegistrations = await UserModel.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    const userRegData = userRegistrations.map(ur => ({
      date: ur._id,
      registrations: ur.count
    }));

    // Uploads per day (last 30 days)
    const uploadsPerDay = await File.aggregate([
      { $match: { deletedAt: null, uploadDate: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$uploadDate" } },
          uploads: { $sum: 1 },
          totalSize: { $sum: "$size" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    const uploadsData = uploadsPerDay.map(u => ({
      date: u._id,
      uploads: u.uploads,
      size: u.totalSize
    }));

    // Actions breakdown (last 30 days)
    const recentLogs = await Log.find({ date: { $gte: thirtyDaysAgo } });
    const actionsCount = {};
    recentLogs.forEach(log => {
      actionsCount[log.action] = (actionsCount[log.action] || 0) + 1;
    });
    const actionsData = Object.entries(actionsCount).map(([action, count]) => ({
      action,
      count
    }));

    // Most active users (by log entries)
    const userActivity = await Log.aggregate([
      { $match: { user: { $ne: null }, date: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: "$user",
          actions: { $sum: 1 },
          lastActivity: { $max: "$date" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          email: "$userInfo.email",
          actions: 1,
          lastActivity: 1
        }
      },
      { $sort: { actions: -1 } },
      { $limit: 10 }
    ]);

    // Storage by user (top 10)
    const userStorage = await File.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: "$userId",
          totalFiles: { $sum: 1 },
          totalSize: { $sum: "$size" }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          email: "$userInfo.email",
          totalFiles: 1,
          totalSize: 1
        }
      },
      { $sort: { totalSize: -1 } },
      { $limit: 10 }
    ]);

    // Groups statistics
    const totalGroups = await Group.countDocuments();
    const groupsWithMembers = await Group.countDocuments({ "members.0": { $exists: true } });

    // Recent activity (last 24 hours)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const recentActivity = await Log.find({ date: { $gte: oneDayAgo } })
      .populate("user", "email")
      .sort({ date: -1 })
      .limit(50);

    res.json({
      // Basic stats
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalFiles,
      totalFolders,
      totalGroups,
      groupsWithMembers,
      totalStorage,
      avgFileSize,

      // Time-based data
      uploadsPerDay: uploadsData,
      userRegistrations: userRegData,
      actionsCount: actionsData,

      // Distribution data
      fileTypes: fileTypeData,

      // Top users
      mostActiveUsers: userActivity,
      topStorageUsers: userStorage,

      // Recent activity
      recentActivity: recentActivity.map(log => ({
        id: log._id,
        date: log.date,
        user: log.user?.email || "System",
        action: log.action,
        details: log.details
      }))
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
// ? RENAME FOLDER
app.put("/folders/:id/rename", async (req, res) => {
  try {
    const { id } = req.params;
    const { newName, userId, role } = req.body;
    const actorRole = await resolveActorRole(userId, role);

    if (!newName || !newName.trim())
      return res.status(400).json({ error: "Invalid name" });

    const folder = await Folder.findById(id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    if (await isFolderWithinLockedCopc(folder._id)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }

    const ownerId = folder.owner?.toString?.() || folder.owner;
    const isOwner = !!userId && ownerId?.toString() === userId.toString();
    const isAdmin = canEditAnyDocuments(actorRole);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to rename this folder" });
    }

    const oldName = folder.name;
    folder.name = newName.trim();
    await folder.save();

    // Create folder version for rename
    const latestVersion = await FolderVersion.findOne({ folderId: id })
      .sort({ versionNumber: -1 });
    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await FolderVersion.updateMany(
      { folderId: id },
      { isCurrent: false }
    );

    const folderVersion = new FolderVersion({
      folderId: id,
      versionNumber,
      name: newName.trim(),
      createdBy: userId || folder.owner,
      changeDescription: `Renamed from "${oldName}" to "${newName}"`,
      changes: { type: "rename", oldName, newName: newName.trim() },
      isCurrent: true
    });
    await folderVersion.save();

    // ? Log rename action
    createLog("RENAME_FOLDER", userId || folder.owner, `Renamed folder to "${newName}"`);

    res.json(folder);
  } catch (err) {
    console.error("Rename folder error:", err);
    res.status(500).json({ error: "Failed to rename folder" });
  }
});


// ? RENAME FILE
app.put("/files/:id/rename", async (req, res) => {
  try {
    const { id } = req.params;
    const { newName, userId, role } = req.body;
    const actorRole = await resolveActorRole(userId, role);

    if (!newName || !newName.trim())
      return res.status(400).json({ error: "Invalid name" });

    const file = await File.findById(id);
    if (!file) return res.status(404).json({ error: "File not found" });
    if (file.parentFolder && await isFolderWithinLockedCopc(file.parentFolder)) {
      return res.status(423).json({ error: "This COPC scope is locked after final approval" });
    }

    const isOwner =
      file.owner?.toString?.() === userId ||
      file.userId?.toString?.() === userId;
    const isAdmin = canEditAnyDocuments(actorRole);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not authorized to rename this file" });
    }

    const oldName = file.originalName;
    file.originalName = newName.trim();
    await file.save();

    const latestVersion = await FileVersion.findOne({ fileId: id }).sort({
      versionNumber: -1,
    });
    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await FileVersion.updateMany({ fileId: id }, { isCurrent: false });
    await FileVersion.create({
      fileId: id,
      versionNumber,
      originalName: file.originalName,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      createdBy: userId || file.owner,
      changeDescription: `Renamed from "${oldName}" to "${newName.trim()}"`,
      isCurrent: true,
    });

    createLog("RENAME_FILE", userId || file.owner, `Renamed file to "${newName}"`);

    res.json(file);
  } catch (err) {
    console.error("Rename file error:", err);
    res.status(500).json({ error: "Failed to rename file" });
  }
});

/* ========================
   GROUPS MANAGEMENT
======================== */

// Create group
app.post("/groups", async (req, res) => {
  try {
    const { name, description, createdBy } = req.body;
    if (!name || !createdBy) {
      return res.status(400).json({ error: "Name and createdBy are required" });
    }

    const group = new Group({
      name,
      description,
      createdBy,
      members: [], // Start with no members
      leaders: [],
      notifications: [],
      announcements: [],
      sharedFiles: [],
      sharedFolders: []
    });

    await group.save();

    // Log group creation
    createLog("CREATE_GROUP", createdBy, `Created group "${name}"`);

    res.json({ success: true, group });
  } catch (err) {
    console.error("Create group error:", err);
    res.status(500).json({ error: "Failed to create group" });
  }
});

// Update group
app.patch("/groups/:id", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const group = await Group.findByIdAndUpdate(
      req.params.id,
      { name, description },
      { new: true }
    )
      .populate("members", "email")
      .populate("leaders", "email")
      .populate("createdBy", "email");

    if (!group) return res.status(404).json({ error: "Group not found" });

    // Log group update
    createLog("UPDATE_GROUP", group.createdBy, `Updated group "${name}"`);

    res.json(group);
  } catch (err) {
    console.error("Update group error:", err);
    res.status(500).json({ error: "Failed to update group" });
  }
});

// Delete group
app.delete("/groups/:id", async (req, res) => {
  try {
    const group = await Group.findByIdAndDelete(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Log group deletion
    createLog("DELETE_GROUP", group.createdBy, `Deleted group "${group.name}"`);

    res.json({ success: true, message: "Group deleted successfully" });
  } catch (err) {
    console.error("Delete group error:", err);
    res.status(500).json({ error: "Failed to delete group" });
  }
});

// Add members to group
app.patch("/groups/:groupId/members", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userIds, actorId } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "userIds array is required" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Add new members (avoid duplicates)
    const existingMemberIds = group.members.map(id => id.toString());
    const newMembers = userIds.filter(id => !existingMemberIds.includes(id.toString()));

    group.members.push(...newMembers);
    await group.save();

    await group.populate("members", "email");

    // Log member addition
    createLog("ADD_GROUP_MEMBERS", group.createdBy, `Added ${newMembers.length} members to group "${group.name}"`);

    await createNotificationsForUsers(
      newMembers,
      "GROUP_INVITE",
      "Added to a group",
      `You were added to the group "${group.name}".`,
      group.description || "",
      group._id,
      "Group",
      {
        actorId: actorId || group.createdBy,
        metadata: {
          groupName: group.name,
        },
      }
    );

    res.json({ success: true, group });
  } catch (err) {
    console.error("Add members error:", err);
    res.status(500).json({ error: "Failed to add members" });
  }
});

// Remove member from group
app.delete("/groups/:groupId/members/:userId", async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const actorId = req.body?.actorId || null;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Remove from members
    group.members = group.members.filter(id => id.toString() !== userId);

    // Also remove from leaders if they were a leader
    group.leaders = group.leaders.filter(id => id.toString() !== userId);

    await group.save();

    await group.populate("members", "email");
    await group.populate("leaders", "email");

    // Log member removal
    createLog("REMOVE_GROUP_MEMBER", group.createdBy, `Removed member from group "${group.name}"`);

    await createNotification(
      userId,
      "GROUP_MEMBER_REMOVED",
      "Removed from group",
      `You were removed from the group "${group.name}".`,
      group.description || "",
      group._id,
      "Group",
      {
        actorId: actorId || group.createdBy,
        metadata: {
          groupName: group.name,
        },
      }
    );

    res.json({ success: true, group });
  } catch (err) {
    console.error("Remove member error:", err);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// Toggle leader status
app.patch("/groups/:groupId/leaders", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, action, actorId } = req.body; // action: "add" or "remove"

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (action === "add") {
      const isMember = group.members.some(id => id.toString() === userId);
      if (!isMember) {
        return res.status(400).json({ error: "User must be a member to be a leader" });
      }
      group.leaders = [userId];
    } else if (action === "remove") {
      // Remove from leaders
      group.leaders = group.leaders.filter(id => id.toString() !== userId);
    } else {
      return res.status(400).json({ error: "Invalid action. Use 'add' or 'remove'" });
    }

    await group.save();

    await group.populate("members", "email");
    await group.populate("leaders", "email");

    // Log leader change
    createLog("TOGGLE_GROUP_LEADER", group.createdBy, `${action === "add" ? "Promoted" : "Demoted"} leader in group "${group.name}"`);

    await createNotification(
      userId,
      action === "add" ? "GROUP_LEADER_ASSIGNED" : "GROUP_LEADER_REMOVED",
      action === "add" ? "Assigned as group leader" : "Removed as group leader",
      action === "add"
        ? `You were assigned as a leader for "${group.name}".`
        : `Your leader role was removed from "${group.name}".`,
      group.description || "",
      group._id,
      "Group",
      {
        actorId: actorId || group.createdBy,
        metadata: {
          groupName: group.name,
        },
      }
    );

    res.json({ success: true, group });
  } catch (err) {
    console.error("Toggle leader error:", err);
    res.status(500).json({ error: "Failed to toggle leader status" });
  }
});

// Add notification to group
app.post("/groups/:groupId/notifications", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, message, createdBy } = req.body;

    if (!title || !message || !createdBy) {
      return res.status(400).json({ error: "Title, message, and createdBy are required" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const notification = {
      title,
      message,
      createdBy,
      createdAt: new Date()
    };

    group.notifications.push(notification);
    await group.save();

    await group.populate("notifications.createdBy", "email");

    // Log notification
    createLog("ADD_GROUP_NOTIFICATION", createdBy, `Added notification to group "${group.name}": ${title}`);

    await createNotificationsForUsers(
      group.members || [],
      "GROUP_NOTIFICATION",
      title,
      message,
      group.name,
      group._id,
      "Group",
      {
        actorId: createdBy,
        metadata: {
          groupName: group.name,
        },
      }
    );

    res.json({ success: true, group });
  } catch (err) {
    console.error("Add notification error:", err);
    res.status(500).json({ error: "Failed to add notification" });
  }
});

// Add announcement to group
app.post("/groups/:groupId/announcements", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, content, createdBy } = req.body;

    if (!title || !content || !createdBy) {
      return res.status(400).json({ error: "Title, content, and createdBy are required" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const announcement = {
      title,
      content,
      createdBy,
      createdAt: new Date()
    };

    group.announcements.push(announcement);
    await group.save();

    await group.populate("announcements.createdBy", "email");

    // Log announcement
    createLog("ADD_GROUP_ANNOUNCEMENT", createdBy, `Added announcement to group "${group.name}": ${title}`);

    await createNotificationsForUsers(
      group.members || [],
      "GROUP_ANNOUNCEMENT",
      title,
      content,
      group.name,
      group._id,
      "Group",
      {
        actorId: createdBy,
        metadata: {
          groupName: group.name,
        },
      }
    );

    res.json({ success: true, group });
  } catch (err) {
    console.error("Add announcement error:", err);
    res.status(500).json({ error: "Failed to add announcement" });
  }
});

// Get groups for a specific user (groups where user is a member)
app.get("/users/:id/groups", async (req, res) => {
  try {
    const userId = req.params.id;
    const groups = await Group.find({ members: userId })
      .populate("members", "email")
      .populate("leaders", "email")
      .populate("createdBy", "email")
      .sort({ createdAt: -1 });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all groups
app.get("/groups", async (req, res) => {
  try {
    const groups = await Group.find()
      .populate("members", "email")
      .populate("leaders", "email")
      .populate("createdBy", "email")
      .populate({
        path: "sharedFiles",
        populate: [
          { path: "fileId", select: "originalName filename mimetype size uploadDate" },
          { path: "sharedBy", select: "email" }
        ]
      })
      .populate({
        path: "sharedFolders",
        populate: [
          { path: "folderId", select: "name createdAt" },
          { path: "sharedBy", select: "email" }
        ]
      })
      .sort({ createdAt: -1 });

    // Filter out shared files and folders that have been deleted
    groups.forEach(group => {
      if (group.sharedFiles) {
        group.sharedFiles = group.sharedFiles.filter(sf => sf.fileId !== null);
      }
      if (group.sharedFolders) {
        group.sharedFolders = group.sharedFolders.filter(sf => sf.folderId !== null);
      }
    });

    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single group
app.get("/groups/:id", async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate("members", "email")
      .populate("leaders", "email")
      .populate("createdBy", "email")
      .populate("notifications.createdBy", "email")
      .populate("announcements.createdBy", "email")
      .populate({
        path: "sharedFiles",
        populate: [
          { path: "fileId", select: "originalName filename mimetype size uploadDate" },
          { path: "sharedBy", select: "email" }
        ]
      })
      .populate({
        path: "sharedFolders",
        populate: [
          { path: "folderId", select: "name createdAt" },
          { path: "sharedBy", select: "email" }
        ]
      });

    if (!group) return res.status(404).json({ error: "Group not found" });

    // Filter out shared files and folders that have been deleted
    if (group.sharedFiles) {
      group.sharedFiles = group.sharedFiles.filter(sf => sf.fileId !== null);
    }
    if (group.sharedFolders) {
      group.sharedFolders = group.sharedFolders.filter(sf => sf.folderId !== null);
    }

    res.json(group);
  } catch (err) {
    console.error("Group fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Share file/folder to group
app.patch("/groups/:groupId/share", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type, itemId, permission } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Check if item is already shared
    const isAlreadyShared = type === "file"
      ? group.sharedFiles.some(sf => sf.fileId.toString() === itemId)
      : group.sharedFolders.some(sf => sf.folderId.toString() === itemId);

    if (isAlreadyShared) {
      return res.status(400).json({ error: `${type} is already shared with this group` });
    }

    const sharedBy = req.body.sharedBy; // Get the user who is sharing
    if (!sharedBy) {
      return res.status(400).json({ error: "sharedBy is required" });
    }

    const sharedItem = {
      [type === "file" ? "fileId" : "folderId"]: itemId,
      permission: normalizePermissionRole(permission, "viewer"),
      sharedBy: sharedBy,
      sharedAt: new Date()
    };

    if (type === "file") {
      group.sharedFiles.push(sharedItem);
    } else {
      group.sharedFolders.push(sharedItem);
    }

    await group.save();

    // Log the action
    createLog("GROUP_SHARE", sharedBy, `Shared ${type} ${itemId} with group "${group.name}"`);

    await createNotificationsForUsers(
      group.members || [],
      "GROUP_SHARE",
      `New ${type} shared in group`,
      `${type === "file" ? "A file" : "A folder"} was shared in "${group.name}".`,
      `Permission: ${sharedItem.permission}`,
      group._id,
      "Group",
      {
        actorId: sharedBy,
        metadata: {
          groupName: group.name,
          itemType: type,
          permission: sharedItem.permission,
        },
      }
    );

    res.json({ success: true, group });
  } catch (err) {
    console.error("Group share error:", err);
    res.status(500).json({ error: "Failed to share item with group" });
  }
});

// Unshare file/folder from group
app.patch("/groups/:groupId/unshare", async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type, itemId } = req.body;

    console.log("Unshare request:", { groupId, type, itemId });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const userId = req.body.userId || "admin"; // Get from request or default to admin

    console.log(`Group ${group.name} has ${group.sharedFiles.length} shared files, ${group.sharedFolders.length} shared folders`);

    if (type === "file") {
      const beforeCount = group.sharedFiles.length;
      group.sharedFiles = group.sharedFiles.filter(sf => {
        // Try multiple comparison methods to be robust
        const idString = sf._id.toString();
        const match = idString !== itemId && sf._id.toString() !== itemId;
        return match;
      });
      console.log(`Filtered shared files: ${beforeCount} -> ${group.sharedFiles.length}`);
    } else {
      const beforeCount = group.sharedFolders.length;
      group.sharedFolders = group.sharedFolders.filter(sf => {
        // Try multiple comparison methods to be robust
        const idString = sf._id.toString();
        const match = idString !== itemId && sf._id.toString() !== itemId;
        return match;
      });
      console.log(`Filtered shared folders: ${beforeCount} -> ${group.sharedFolders.length}`);
    }

    await group.save();
    console.log("Group saved successfully");

    // Log the action
    createLog("GROUP_UNSHARE", userId, `Removed ${type} ${itemId} from group "${group.name}"`);

    await createNotificationsForUsers(
      group.members || [],
      "GROUP_UNSHARE",
      `${type === "file" ? "File" : "Folder"} removed from group`,
      `${type === "file" ? "A file" : "A folder"} was removed from "${group.name}".`,
      "",
      group._id,
      "Group",
      {
        actorId: userId,
        metadata: {
          groupName: group.name,
          itemType: type,
        },
      }
    );

    res.json({ success: true, group });
  } catch (err) {
    console.error("Group unshare error:", err);
    res.status(500).json({ error: "Failed to remove item from group" });
  }
});

/* ========================
   PASSWORD REQUEST MANAGEMENT
======================== */

// Submit password change request (User)
app.post("/user/password-request", async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify user exists
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Verify current password
    if (user.password !== currentPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Check if user already has a pending request
    const existingRequest = await PasswordRequest.findOne({
      userId,
      status: "pending"
    });

    if (existingRequest) {
      return res.status(400).json({ error: "You already have a pending password change request" });
    }

    // Create password change request
    const passwordRequest = new PasswordRequest({
      userId,
      currentPassword, // Store for verification during approval
      newPassword,
      status: "pending"
    });

    await passwordRequest.save();

    // Log the request
    createLog("PASSWORD_CHANGE_REQUEST", userId, `Submitted password change request`);

    const admins = await UserModel.find({ role: "superadmin", active: { $ne: false } }).select("_id");
    await createNotificationsForUsers(
      admins.map((entry) => entry._id),
      "PASSWORD_CHANGE_REQUEST",
      "Password change request submitted",
      `${user.email} submitted a password change request.`,
      "Review the request in Manage Users.",
      passwordRequest._id,
      "User",
      {
        actorId: userId,
        metadata: {
          requesterEmail: user.email,
        },
      }
    );

    res.json({ success: true, message: "Password change request submitted successfully" });
  } catch (err) {
    console.error("Password request error:", err);
    res.status(500).json({ error: "Failed to submit password change request" });
  }
});

// Get all password requests (Admin only)
app.get("/admin/password-requests", async (req, res) => {
  try {
    const { role, userId } = req.query;
    const actorRole = await resolveActorRole(userId, role);

    if (!canManageUsers(actorRole)) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    // First get the requests without populate to avoid issues with null values
    const requests = await PasswordRequest.find().sort({ createdAt: -1 });

    // Then populate each request individually, handling null values
    const populatedRequests = await Promise.all(
      requests.map(async (request) => {
        const populatedRequest = request.toObject();

        // Populate userId (should always exist)
        try {
          const user = await UserModel.findById(request.userId).select("email name");
          populatedRequest.userId = user;
        } catch (err) {
          console.error(`Error populating userId ${request.userId}:`, err);
          populatedRequest.userId = null;
        }

        // Populate reviewedBy (might be null for pending requests)
        if (request.reviewedBy) {
          try {
            const reviewer = await UserModel.findById(request.reviewedBy).select("email name");
            populatedRequest.reviewedBy = reviewer;
          } catch (err) {
            console.error(`Error populating reviewedBy ${request.reviewedBy}:`, err);
            populatedRequest.reviewedBy = null;
          }
        } else {
          populatedRequest.reviewedBy = null;
        }

        return populatedRequest;
      })
    );

    res.json(populatedRequests);
  } catch (err) {
    console.error("Fetch password requests error:", err);
    res.status(500).json({ error: "Failed to fetch password requests" });
  }
});

// Approve password change request (Admin only)
app.patch("/admin/password-requests/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ error: "Admin ID required" });
    }

    // Verify admin role
    const admin = await UserModel.findById(adminId);
    if (!admin || !canManageUsers(admin.role)) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const request = await PasswordRequest.findById(id);
    if (!request) return res.status(404).json({ error: "Password request not found" });

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request is not pending" });
    }

    // Update user password
    await UserModel.findByIdAndUpdate(request.userId, {
      password: request.newPassword
    });

    // Update request status
    request.status = "approved";
    request.reviewedAt = new Date();
    request.reviewedBy = adminId;
    request.reviewNotes = "Approved by admin";
    await request.save();

    // Log the approval
    createLog("PASSWORD_CHANGE_APPROVED", adminId, `Approved password change for user ${request.userId}`);

    // Create notification for user
    await createNotification(
      request.userId,
      "PASSWORD_CHANGE_APPROVED",
      "Password Change Approved",
      "Your password change request has been approved",
      "You can now log in with your new password",
      request._id,
      "User",
      {
        actorId: adminId,
      }
    );

    res.json({ success: true, message: "Password change request approved" });
  } catch (err) {
    console.error("Approve password request error:", err);
    res.status(500).json({ error: "Failed to approve password change request" });
  }
});

// Reject password change request (Admin only)
app.patch("/admin/password-requests/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ error: "Admin ID required" });
    }

    // Verify admin role
    const admin = await UserModel.findById(adminId);
    if (!admin || !canManageUsers(admin.role)) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const request = await PasswordRequest.findById(id);
    if (!request) return res.status(404).json({ error: "Password request not found" });

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request is not pending" });
    }

    // Update request status
    request.status = "rejected";
    request.reviewedAt = new Date();
    request.reviewedBy = adminId;
    request.reviewNotes = "Rejected by admin";
    await request.save();

    // Log the rejection
    createLog("PASSWORD_CHANGE_REJECTED", adminId, `Rejected password change for user ${request.userId}`);

    // Create notification for user
    await createNotification(
      request.userId,
      "PASSWORD_CHANGE_REJECTED",
      "Password Change Rejected",
      "Your password change request has been rejected",
      "Please contact your administrator for more information",
      request._id,
      "User",
      {
        actorId: adminId,
      }
    );

    res.json({ success: true, message: "Password change request rejected" });
  } catch (err) {
    console.error("Reject password request error:", err);
    res.status(500).json({ error: "Failed to reject password change request" });
  }
});

/* ========================
   NOTIFICATIONS MANAGEMENT
======================== */

app.post("/notifications/smart/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "User ID required" });

    const now = Date.now();
    const created = [];
    const createdKeys = new Set();

    const canCreate = async (type, details) => {
      const key = `${type}:${details}`;
      if (createdKeys.has(key)) return false;
      createdKeys.add(key);
      const existing = await Notification.findOne({
        userId,
        type,
        details,
        createdAt: { $gte: new Date(now - 1000 * 60 * 60 * 12) },
      });
      return !existing;
    };

    const duplicateFiles = await File.find({
      userId,
      deletedAt: null,
      duplicateOf: { $ne: null },
    })
      .select("_id originalName")
      .limit(5);

    for (const file of duplicateFiles) {
      const details = file.originalName;
      if (await canCreate("DUPLICATE_ALERT", details)) {
        const notif = await createNotification(
          userId,
          "DUPLICATE_ALERT",
          "Duplicate File Detected",
          `Duplicate found: ${file.originalName}. Review and clean up duplicates.`,
          details,
          file._id,
          "File"
        );
        if (notif) created.push(notif);
      }
    }

    const writableSharedFiles = await File.find({
      sharedWith: userId,
      deletedAt: null,
      permissions: { $in: ["editor", "write"] },
    })
      .select("_id originalName")
      .limit(5);

    for (const file of writableSharedFiles) {
      const details = file.originalName;
      if (await canCreate("REVIEW_REQUIRED", details)) {
        const notif = await createNotification(
          userId,
          "REVIEW_REQUIRED",
          "Document Requires Your Action",
          `You have editor access to "${file.originalName}". Review or update if needed.`,
          details,
          file._id,
          "File"
        );
        if (notif) created.push(notif);
      }
    }

    const lowConfidenceFiles = await File.find({
      userId,
      deletedAt: null,
      "classification.confidence": { $lt: 0.6 },
    })
      .select("_id originalName")
      .limit(5);

    for (const file of lowConfidenceFiles) {
      const details = file.originalName;
      if (await canCreate("ACTION_REQUIRED", details)) {
        const notif = await createNotification(
          userId,
          "ACTION_REQUIRED",
          "Document Needs Review",
          `"${file.originalName}" may need recategorization or validation.`,
          details,
          file._id,
          "File"
        );
        if (notif) created.push(notif);
      }
    }

    res.json({ success: true, createdCount: created.length, notifications: created });
  } catch (err) {
    console.error("Smart notifications error:", err);
    res.status(500).json({ error: "Failed to generate smart notifications" });
  }
});

// Get notifications for a user
app.get("/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .populate("actorId", "email name role profilePicture")
      .limit(100); // Limit to prevent too many results

    res.json(notifications);
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark notification as read
app.patch("/notifications/:notificationId/read", async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, notification });
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// Mark all notifications as read for a user
app.patch("/notifications/:userId/read-all", async (req, res) => {
  try {
    const { userId } = req.params;

    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

// Test endpoint to create sample notifications (for testing)
app.post("/notifications/test/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const testNotifications = [
      {
        userId,
        type: "SHARE_FILE",
        title: "File Shared",
        message: "A file has been shared with you",
        details: "sample-document.pdf"
      },
      {
        userId,
        type: "PASSWORD_CHANGE_REQUEST",
        title: "Password Change Request",
        message: "Your password change request has been submitted",
        details: "Pending admin approval"
      },
      {
        userId,
        type: "COMMENT",
        title: "New Comment",
        message: "Someone commented on your file",
        details: "This looks great!"
      },
      {
        userId,
        type: "UPLOAD",
        title: "New Upload",
        message: "A new file has been uploaded",
        details: "presentation.pptx"
      }
    ];

    const createdNotifications = await Notification.insertMany(testNotifications);

    res.json({
      success: true,
      message: `Created ${createdNotifications.length} test notifications`,
      notifications: createdNotifications
    });
  } catch (err) {
    console.error("Create test notifications error:", err);
    res.status(500).json({ error: "Failed to create test notifications" });
  }
});

function normalizeNotificationId(value) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

function uniqNotificationIds(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeNotificationId(value))
        .filter(Boolean)
    )
  );
}

async function getNotificationActorLabel(actorId) {
  const normalized = normalizeNotificationId(actorId);
  if (!normalized) return "Someone";
  try {
    const actor = await UserModel.findById(normalized).select("name email");
    return actor?.name || actor?.email || "Someone";
  } catch {
    return "Someone";
  }
}

async function getItemNotificationContext(itemId, itemType) {
  if (!itemId || !itemType) {
    return { ownerId: null, label: "item", relatedModel: null };
  }

  if (String(itemType).toLowerCase() === "file") {
    const file = await File.findById(itemId).select("owner originalName");
    return {
      ownerId: normalizeNotificationId(file?.owner),
      label: file?.originalName || "file",
      relatedModel: "File",
    };
  }

  const folder = await Folder.findById(itemId).select("owner name");
  return {
    ownerId: normalizeNotificationId(folder?.owner),
    label: folder?.name || "folder",
    relatedModel: "Folder",
  };
}

async function getGroupMemberIds(groupId) {
  const group = await Group.findById(groupId).select("members");
  return uniqNotificationIds(group?.members || []);
}

async function getCopcStakeholderIds(folderOrId) {
  const root =
    typeof folderOrId === "object" && folderOrId?._id
      ? folderOrId
      : await findCopcRootFolderByFolderId(folderOrId);
  if (!root) return [];

  const assignments = root.folderAssignments || {};
  return uniqNotificationIds([
    root.owner,
    ...(assignments.uploaders || []),
    ...(assignments.programChairs || []),
    ...(assignments.qaOfficers || []),
    ...(assignments.evaluators || []),
  ]);
}

function diffNotificationRecipients(next = [], previous = []) {
  const prevSet = new Set(uniqNotificationIds(previous));
  return uniqNotificationIds(next).filter((id) => !prevSet.has(id));
}

async function createNotificationsForUsers(
  userIds,
  type,
  title,
  message,
  details = "",
  relatedId = null,
  relatedModel = null,
  options = {}
) {
  const targets = uniqNotificationIds(userIds);
  const created = [];
  for (const targetId of targets) {
    const notification = await createNotification(
      targetId,
      type,
      title,
      message,
      details,
      relatedId,
      relatedModel,
      options
    );
    if (notification) created.push(notification);
  }
  return created;
}

async function createNotification(
  userId,
  type,
  title,
  message,
  details = "",
  relatedId = null,
  relatedModel = null,
  options = {}
) {
  try {
    const recipientId = normalizeNotificationId(userId);
    const actorId = normalizeNotificationId(options.actorId);
    if (!recipientId) return null;
    if (!options.allowSelf && actorId && actorId === recipientId) {
      return null;
    }

    // Create the notification in database
    const notification = new Notification({
      userId: recipientId,
      type,
      actorId,
      title,
      message,
      details,
      relatedId,
      relatedModel,
      metadata: options.metadata || {},
      createdAt: new Date(),
      date: new Date(),
    });

    await notification.save();

    // Get user email for sending notification email
    try {
      const user = await UserModel.findById(recipientId).select("email");
      if (user && user.email) {
        const actorLabel = options.actorLabel || (await getNotificationActorLabel(actorId));
        // Send email notification asynchronously (don't block on email sending)
        sendNotificationEmail(user.email, type, {
          userId: recipientId,
          title,
          message,
          details,
          fileName: options.metadata?.fileName || details,
          groupName: options.metadata?.groupName || null,
          sharerName: actorLabel,
          actorName: actorLabel,
          loginUrl: process.env.FRONTEND_URL || "http://localhost:5173",
        }).catch(emailErr => {
          console.error("Failed to send notification email:", emailErr);
          // Don't throw - email failure shouldn't break notification creation
        });
      }
    } catch (userErr) {
      console.error("Failed to get user email for notification:", userErr);
    }

    return notification;
  } catch (err) {
    console.error("Create notification error:", err);
    // Don't throw - notifications are not critical
  }
}

// Test email endpoint
app.post("/test-email", async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({ error: "Missing required fields: to, subject, message" });
    }

    const result = await sendEmail(to, subject, `<p>${message}</p>`, message);

    if (result.success) {
      res.json({ success: true, messageId: result.messageId });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (err) {
    console.error("Test email error:", err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

/* ========================
   START SERVER
======================== */

/* ========================
   ADMIN SEARCH
======================== */
app.get("/admin/search", async (req, res) => {
  try {
    const {
      query,
      userId,
      role,
      limit,
      searchType,
      entityTypes,
      fileTypes,
      owner,
      datePreset,
      dateFrom,
      dateTo,
      scope = "both",
      sortBy = "relevance",
      sortOrder = "desc",
      exactMatch,
      favoritesOnly,
      pinnedOnly,
      sharedOnly,
      duplicatesOnly,
    } = req.query;
    const searchTerm = String(query || "").trim();

    const actorRole = await resolveActorRole(userId, role);
    if (!canManageUsers(actorRole)) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const hasSearchTerm = searchTerm.length > 0;
    const limitNum = Math.max(5, Math.min(parseInt(limit || "20", 10) || 20, 120));
    const typeValues = parseCsvList(entityTypes);
    const includeTypes = new Set(
      typeValues.length
        ? typeValues
        : searchType && searchType !== "all"
        ? [searchType]
        : ["file", "folder", "user", "group", "log"]
    );
    const includeName = scope !== "content";
    const includeContent = scope === "content" || scope === "both";
    const useExactMatch = parseBoolean(exactMatch);
    const dateRange = resolveDateRange({ datePreset, dateFrom, dateTo });
    const mimeRegex = buildMimeRegex(parseCsvList(fileTypes));
    const termRegex = useExactMatch
      ? new RegExp(`^${escapeRegex(searchTerm)}$`, "i")
      : new RegExp(escapeRegex(searchTerm), "i");
    const searchLower = searchTerm.toLowerCase();

    const results = [];
    const toOwnerSummary = (ownerDoc) => {
      if (!ownerDoc) return null;
      const ownerId = ownerDoc._id || ownerDoc;
      if (!ownerId) return null;
      return {
        _id: ownerId,
        email: ownerDoc.email || null,
      };
    };

    let ownerIds = null;
    if (owner) {
      const ownerUsers = await UserModel.find({
        $or: [{ email: { $regex: owner, $options: "i" } }, { name: { $regex: owner, $options: "i" } }],
      }).select("_id");
      ownerIds = ownerUsers.map((u) => u._id);
      if (!ownerIds.length) ownerIds = ["000000000000000000000000"];
    }

    if (includeTypes.has("user")) {
      const userQuery = {};
      if (hasSearchTerm) {
        userQuery.$or = [{ name: termRegex }, { email: termRegex }];
      }
      if (dateRange) userQuery.createdAt = dateRange;
      const users = await UserModel.find(userQuery).select("name email role createdAt active").limit(limitNum);

      users.forEach(user => {
        results.push({
          _id: user._id,
          type: "user",
          name: user.name || user.email,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          active: user.active
        });
      });
    }

    if (includeTypes.has("group")) {
      const groupQuery = {};
      if (hasSearchTerm) {
        groupQuery.$or = [{ name: termRegex }, { description: termRegex }];
      }
      if (dateRange) groupQuery.createdAt = dateRange;
      const groups = await Group.find(groupQuery).select("name description createdAt members").limit(limitNum);

      groups.forEach(group => {
        results.push({
          _id: group._id,
          type: "group",
          name: group.name,
          description: group.description,
          createdAt: group.createdAt,
          memberCount: group.members?.length || 0
        });
      });
    }

    if (includeTypes.has("log")) {
      const logQuery = {};
      if (hasSearchTerm) {
        logQuery.$or = [{ action: termRegex }, { details: termRegex }];
      }
      if (dateRange) logQuery.date = dateRange;
      const logs = await Log.find(logQuery)
        .populate("user", "email")
        .sort({ date: -1 })
        .limit(limitNum);

      logs.forEach(log => {
        results.push({
          _id: log._id,
          type: "log",
          action: log.action,
          details: log.details,
          date: log.date,
          userEmail: log.user?.email || "System"
        });
      });
    }

    if (includeTypes.has("file")) {
      const fileBaseQuery = { deletedAt: null };
      if (ownerIds) fileBaseQuery.owner = { $in: ownerIds };
      if (mimeRegex) fileBaseQuery.mimetype = mimeRegex;
      if (dateRange) fileBaseQuery.uploadDate = dateRange;
      if (parseBoolean(favoritesOnly)) fileBaseQuery.favoritedBy = { $exists: true, $ne: [] };
      if (parseBoolean(pinnedOnly)) fileBaseQuery.pinnedBy = { $exists: true, $ne: [] };
      if (parseBoolean(duplicatesOnly)) fileBaseQuery.duplicateOf = { $ne: null };
      if (parseBoolean(sharedOnly)) fileBaseQuery.sharedWith = { $exists: true, $ne: [] };

      const filesByName =
        hasSearchTerm && includeName
          ? await File.find({ ...fileBaseQuery, originalName: termRegex })
              .populate("owner", "email")
              .limit(limitNum * 2)
          : await File.find(fileBaseQuery)
              .populate("owner", "email")
              .sort({ uploadDate: -1 })
              .limit(limitNum * 2);

      filesByName.forEach(file => {
        const fileOwner = toOwnerSummary(file.owner);
        results.push({
          _id: file._id,
          type: "file",
          name: file.originalName,
          originalName: file.originalName,
          mimetype: file.mimetype,
          size: file.size,
          uploadDate: file.uploadDate,
          owner: fileOwner,
          ownerId: fileOwner?._id || null,
          ownerEmail: fileOwner?.email || null,
          path: file.parentFolder ? 'In folder' : 'Root'
        });
      });

      if (!(hasSearchTerm && includeContent)) {
        // skip deep content search when query is empty or name-only scope
      } else {
      const allFiles = await File.find(fileBaseQuery).populate("owner", "email").limit(limitNum * 4);
      const fileIdsAlreadyFound = new Set(filesByName.map(f => f._id.toString()));

      for (const file of allFiles) {
        // Skip files already found by name
        if (fileIdsAlreadyFound.has(file._id.toString())) {
          continue;
        }

        // Only search inside text-based files or supported document types
        const textMimeTypes = [
          "text/",
          "application/json",
          "application/javascript",
          "application/xml",
          "application/x-sh",
          "application/x-bat",
          "application/x-csv",
        ];

        const isTextFile = textMimeTypes.some(mime => file.mimetype?.startsWith(mime));
        const isPdf = file.mimetype?.includes("pdf");
        const isDocx = file.mimetype?.includes("vnd.openxmlformats-officedocument.wordprocessingml.document") ||
                       (file.originalName && file.originalName.toLowerCase().endsWith(".docx"));
        const isXlsx = file.mimetype?.includes("spreadsheetml") ||
                       file.mimetype?.includes("vnd.ms-excel") ||
                       (file.originalName && (file.originalName.toLowerCase().endsWith(".xlsx") || file.originalName.toLowerCase().endsWith(".xls")));

        if (isTextFile) {
          try {
            const filePath = path.join(__dirname, "uploads", file.filename);

            // Check if file exists and is not too large (limit to 10MB for search)
            if (fs.existsSync(filePath) && file.size < 10 * 1024 * 1024) {
              // Read text file content
              const fileContent = fs.readFileSync(filePath, "utf8").toLowerCase();

              // Search for the term in file content
              if (fileContent.includes(searchLower)) {
                const fileOwner = toOwnerSummary(file.owner);
                results.push({
                  _id: file._id,
                  type: "file",
                  name: file.originalName,
                  originalName: file.originalName,
                  mimetype: file.mimetype,
                  size: file.size,
                  uploadDate: file.uploadDate,
                  owner: fileOwner,
                  ownerId: fileOwner?._id || null,
                  ownerEmail: fileOwner?.email || null,
                  path: file.parentFolder ? 'In folder' : 'Root',
                  matchedBy: 'content'
                });
                fileIdsAlreadyFound.add(file._id.toString());
              }
            }
          } catch (readErr) {
            continue;
          }
        } else if ((isPdf || isDocx || isXlsx) && file.size < 15 * 1024 * 1024) {
          try {
            const filePath = path.join(__dirname, "uploads", file.filename);
            if (!fs.existsSync(filePath)) continue;

            if (isPdf) {
              try {
                const pdfParse = require("pdf-parse");
                const dataBuffer = fs.readFileSync(filePath);
                const parsed = await pdfParse(dataBuffer);
                const text = (parsed.text || "").toLowerCase();
                if (text.includes(searchLower)) {
                  const fileOwner = toOwnerSummary(file.owner);
                  results.push({
                    _id: file._id,
                    type: "file",
                    name: file.originalName,
                    originalName: file.originalName,
                    mimetype: file.mimetype,
                    size: file.size,
                    uploadDate: file.uploadDate,
                    owner: fileOwner,
                    ownerId: fileOwner?._id || null,
                    ownerEmail: fileOwner?.email || null,
                    path: file.parentFolder ? 'In folder' : 'Root',
                    matchedBy: 'content'
                  });
                  fileIdsAlreadyFound.add(file._id.toString());
                }
              } catch (pdfErr) {
                console.error(`PDF parse failed for ${file.filename}:`, pdfErr.message);
              }
            }

            if (isDocx && !fileIdsAlreadyFound.has(file._id.toString())) {
              try {
                const mammoth = require("mammoth");
                const result = await mammoth.extractRawText({ path: filePath });
                const text = (result.value || "").toLowerCase();
                if (text.includes(searchLower)) {
                  const fileOwner = toOwnerSummary(file.owner);
                  results.push({
                    _id: file._id,
                    type: "file",
                    name: file.originalName,
                    originalName: file.originalName,
                    mimetype: file.mimetype,
                    size: file.size,
                    uploadDate: file.uploadDate,
                    owner: fileOwner,
                    ownerId: fileOwner?._id || null,
                    ownerEmail: fileOwner?.email || null,
                    path: file.parentFolder ? 'In folder' : 'Root',
                    matchedBy: 'content'
                  });
                  fileIdsAlreadyFound.add(file._id.toString());
                }
              } catch (docxErr) {
                console.error(`DOCX parse failed for ${file.filename}:`, docxErr.message);
              }
            }

            if (isXlsx && !fileIdsAlreadyFound.has(file._id.toString())) {
              try {
                const XLSX = require("xlsx");
                const workbook = XLSX.readFile(filePath, { cellHTML: false, cellText: true });
                let combined = "";
                for (const sheetName of workbook.SheetNames) {
                  const sheet = workbook.Sheets[sheetName];
                  const csv = XLSX.utils.sheet_to_csv(sheet);
                  if (csv) combined += " " + csv.toLowerCase();
                }
                if (combined.includes(searchLower)) {
                  const fileOwner = toOwnerSummary(file.owner);
                  results.push({
                    _id: file._id,
                    type: "file",
                    name: file.originalName,
                    originalName: file.originalName,
                    mimetype: file.mimetype,
                    size: file.size,
                    uploadDate: file.uploadDate,
                    owner: fileOwner,
                    ownerId: fileOwner?._id || null,
                    ownerEmail: fileOwner?.email || null,
                    path: file.parentFolder ? 'In folder' : 'Root',
                    matchedBy: 'content'
                  });
                  fileIdsAlreadyFound.add(file._id.toString());
                }
              } catch (xlsxErr) {
                console.error(`XLSX parse failed for ${file.filename}:`, xlsxErr.message);
              }
            }
          } catch (docErr) {
            continue;
          }
        }
      }}
    }

    if (includeTypes.has("folder")) {
      const folderQuery = { deletedAt: null };
      if (ownerIds) folderQuery.owner = { $in: ownerIds };
      if (dateRange) folderQuery.createdAt = dateRange;
      if (parseBoolean(sharedOnly)) folderQuery.sharedWith = { $exists: true, $ne: [] };
      if (hasSearchTerm) folderQuery.name = termRegex;
      const foldersByName = await Folder.find(folderQuery)
        .populate("owner", "email")
        .sort({ createdAt: -1 })
        .limit(limitNum * 2);

      foldersByName.forEach(folder => {
        const folderOwner = toOwnerSummary(folder.owner);
        results.push({
          _id: folder._id,
          type: "folder",
          name: folder.name,
          createdAt: folder.createdAt,
          owner: folderOwner,
          ownerId: folderOwner?._id || null,
          ownerEmail: folderOwner?.email || null,
          path: folder.parentFolder ? 'In folder' : 'Root'
        });
      });
    }

    const scoreResult = (item) => {
      if (!hasSearchTerm) return 0;
      const val = (item.name || item.action || "").toLowerCase();
      if (val === searchLower) return 100;
      if (val.startsWith(searchLower)) return 70;
      if (val.includes(searchLower)) return 50;
      if (item.matchedBy === "content") return 35;
      return 10;
    };

    results.sort((a, b) => {
      const direction = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "name") {
        return direction * (a.name || a.action || "").localeCompare(b.name || b.action || "");
      }
      if (sortBy === "size") {
        return direction * ((a.size || 0) - (b.size || 0));
      }
      if (sortBy === "relevance" && hasSearchTerm) {
        const scoreDelta = scoreResult(b) - scoreResult(a);
        if (scoreDelta !== 0) return scoreDelta;
      }

      const typeOrder = { file: 0, folder: 0, user: 1, group: 2, log: 3 };
      const typeA = typeOrder[a.type] ?? 4;
      const typeB = typeOrder[b.type] ?? 4;
      if (typeA !== typeB) return typeA - typeB;

      const dateA = new Date(a.createdAt || a.date || a.uploadDate || 0);
      const dateB = new Date(b.createdAt || b.date || b.uploadDate || 0);
      return direction * (dateA - dateB);
    });

    res.json(results.slice(0, limitNum));
  } catch (err) {
    console.error("Admin search error:", err);
    res.status(500).json({ error: "Failed to search" });
  }
});

/* ========================
   START SERVER
======================== */
app.listen(PORT, HOST, () => {
  console.log(`ðŸš€ Server running on http://${HOST}:${PORT}`);
  console.log(`Allowed CORS origins: ${Array.from(allowedCorsOrigins).join(", ")}`);
  console.log(`LAN CORS fallback: ${allowLanCors ? "enabled" : "disabled"}`);
  createLog("SYSTEM", null, `Server started on ${HOST}:${PORT}`);
});


