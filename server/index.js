const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, '.env') });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");

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
const { sendNotificationEmail } = require("./emailService");

const app = express();
app.use(cors());
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

/* ========================
   MONGODB
======================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    createLog("SYSTEM", null, "MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB error:", err);
    createLog("SYSTEM_ERROR", null, `MongoDB connection error: ${err.message || err}`);
  });

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
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

function userHasFileAccess(file, userId, role) {
  if (!file || !userId) return false;
  const isAdmin = role === "admin" || role === "superadmin";
  if (isAdmin) return true;
  const ownerId = file.owner?._id?.toString?.() || file.owner?.toString?.() || file.userId?.toString?.() || file.userId;
  if (ownerId?.toString() === userId.toString()) return true;
  return !!file.sharedWith?.some((id) => {
    const sharedId = id?.toString ? id.toString() : id;
    return sharedId?.toString() === userId.toString();
  });
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
  const isAdmin = role === "admin" || role === "superadmin";
  if (isAdmin) return true;

  const ownerId = file.owner?._id?.toString?.() || file.owner?.toString?.() || file.userId?.toString?.() || file.userId;
  const isOwner = ownerId?.toString() === userId.toString();
  const isSharedWithWrite =
    !!file.sharedWith?.some((id) => (id?.toString ? id.toString() : id) === userId) &&
    file.permissions === "write";
  const isLeader = await isGroupLeaderForFile(userId, file._id);

  return isOwner || isSharedWithWrite || isLeader;
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
        "UPLOAD",
        "Welcome to DocuDB!",
        "Welcome to DocuDB! Start by uploading your first file or creating a folder.",
        "Getting started guide"
      );
    }

    res.json({
      status: "success",
      role: user.role,
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

    const { userId, parentFolder, isUpdate, fileId, changeDescription } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

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

      const isOwner =
        file.owner?.toString?.() === userId ||
        file.userId?.toString?.() === userId;
      const isSharedWithWrite =
        file.sharedWith?.some(id => id.toString() === userId) &&
        file.permissions === "write";
      const isLeader = await isGroupLeaderForFile(userId, file._id);
      if (!isOwner && !isSharedWithWrite && !isLeader) {
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

    let folders = [];
    if (role === "admin" || role === "superadmin") {
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
    const isAdmin = role === "admin" || role === "superadmin";
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

    const isAdmin = role === "admin" || role === "superadmin";
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

    const isAdmin = role === "admin" || role === "superadmin";
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
    if (!userHasFileAccess(file, userId, role)) {
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
    if (!userHasFileAccess(file, userId, role)) {
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
    const isAdmin = role === "admin" || role === "superadmin";

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
    const isAdmin = role === "admin" || role === "superadmin";
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
    const isAdmin = role === "admin" || role === "superadmin";
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

    const isAdmin = role === "admin" || role === "superadmin";
    if (!isAdmin) {
      const ownerId = doc.owner?._id?.toString() || doc.owner?.toString() || doc.userId;
      const isOwner = ownerId === userId || doc.userId === userId;
      const isShared = userId && doc.sharedWith && doc.sharedWith.some(id => {
        const sharedId = id.toString ? id.toString() : (id._id ? id._id.toString() : id);
        return sharedId === userId;
      });
      if (!isOwner && !isShared) {
        return res.status(403).json({ error: "Forbidden" });
      }
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

    const isAdmin = role === "admin" || role === "superadmin";
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
    const { userId, parentFolder, desiredType, originalName } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
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
    const isAdmin = role === "admin" || role === "superadmin";

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

      // Get files owned by user
      let ownedFiles = await File.find({
        userId,
        deletedAt: null,
        ...(parentFolder !== undefined && { parentFolder: parentFolder === "" ? null : parentFolder })
      })
        .populate("owner", "email")
        .sort(sortOptions);

      // If we have a parentFolder, check if user has access to it (for navigation within shared folders)
      if (parentFolder) {
        const parent = await Folder.findById(parentFolder);
        if (parent && (parent.owner.toString() === userId || parent.sharedWith.includes(userId))) {
          // User has access to parent folder, include ALL files from that folder
          // This allows users to see files uploaded by different users within shared folders
          const subFiles = await File.find({
            parentFolder,
            deletedAt: null
          })
            .populate("owner", "email")
            .sort(sortOptions);

          ownedFiles = [...ownedFiles, ...subFiles];
        }
      } else {
        // Root level - include files shared with user
        const sharedFiles = await File.find({
          sharedWith: userId,
          deletedAt: null,
          parentFolder: null
        })
          .populate("owner", "email")
          .sort(sortOptions);

        ownedFiles = [...ownedFiles, ...sharedFiles];
      }

      files = ownedFiles;
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

    // Add permission info for shared files
    const filesWithPermissions = uniqueFiles.map(file => {
      const isOwner = file.owner._id.toString() === userId;
      const isFavorite = isFlaggedByUser(file.favoritedBy, userId);
      const isPinned = isFlaggedByUser(file.pinnedBy, userId);
      return {
        ...file.toObject(),
        isShared: !isOwner,
        permission: isOwner ? "owner" : (file.permissions || "read"),
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

// View file inline
app.get("/view/:filename", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const doc = await File.findOne({ filename: req.params.filename }).populate("owner");
    if (!doc) return res.status(404).send("File not found");

    const isAdmin = role === "admin" || role === "superadmin";
    if (!isAdmin) {
      // Check permissions: owner or shared with user (read or write)
      const ownerId = doc.owner?._id?.toString() || doc.owner?.toString() || doc.userId;
      const isOwner = ownerId === userId || doc.userId === userId;
      const isShared = userId && doc.sharedWith && doc.sharedWith.some(id => {
        const sharedId = id.toString ? id.toString() : (id._id ? id._id.toString() : id);
        return sharedId === userId;
      });

      if (!isOwner && !isShared) {
        return res.status(403).send("You don't have permission to view this file");
      }
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

    const isAdmin = role === "admin" || role === "superadmin";
    if (!isAdmin) {
      const ownerId = doc.owner?._id?.toString() || doc.owner?.toString() || doc.userId;
      const isOwner = ownerId === userId || doc.userId === userId;
      const isShared = userId && doc.sharedWith && doc.sharedWith.some(id => {
        const sharedId = id.toString ? id.toString() : (id._id ? id._id.toString() : id);
        return sharedId === userId;
      });
      if (!isOwner && !isShared) return res.status(403).send("Forbidden");
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

    const isAdmin = role === "admin" || role === "superadmin";
    if (!isAdmin) {
      const isOwner = (doc.owner?.toString && doc.owner.toString() === userId) || doc.userId === userId;
      const isSharedWithWrite = userId &&
        doc.sharedWith.some(id => (id.toString ? id.toString() : id) === userId) &&
        doc.permissions === "write";
      if (!isOwner && !isSharedWithWrite) {
        return res.status(403).send("You don't have permission to download this file");
      }
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

// Soft delete file → moves to Trash
app.delete("/files/:id", async (req, res) => {
  try {
    const { userId, role } = req.query;
    const isAdmin = role === "admin" || role === "superadmin";
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    if (!isAdmin) {
      const isOwner =
        file.owner?.toString?.() === userId ||
        file.userId?.toString?.() === userId;
      const isSharedWithWrite =
        file.sharedWith?.some(id => id.toString() === userId) &&
        file.permissions === "write";
      const isLeader = await isGroupLeaderForFile(userId, file._id);
      if (!isOwner && !isSharedWithWrite && !isLeader) {
        return res.status(403).json({ error: "Not authorized to delete this file" });
      }
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
    const { newFolderId, userId } = req.body;
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const oldFolderId = file.parentFolder ? file.parentFolder.toString() : null;
    const nextFolderId = newFolderId || null;
    file.parentFolder = nextFolderId;
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
    if (!userHasFileAccess(file, userId, role)) {
      return res.status(403).json({ error: "Not authorized to view file content" });
    }
    if (!isEditableDocument(file)) {
      return res.status(400).json({ error: "This file type is not editable in-app" });
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
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Content must be a string" });
    }

    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });
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
    const { emails, permission } = req.body;
    const users = await UserModel.find({ email: { $in: emails } });
    if (!users.length)
      return res.status(404).json({ error: "No matching users found" });

    const userIds = users.map((u) => u._id);
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    file.sharedWith.push(...userIds);
    if (permission) file.permissions = permission;

    await file.save();
    await file.populate("sharedWith", "email");

    // NEW: log share
    createLog("SHARE_FILE", file.owner, `Shared ${file.originalName} with ${emails.join(", ")}`);

    // Create notifications for shared users
    for (const userId of userIds) {
      await createNotification(
        userId,
        "SHARE_FILE",
        "File Shared",
        `A file has been shared with you`,
        file.originalName,
        file._id,
        "File"
      );
    }

    res.json({ status: "success", file });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Unshare file (remove user from sharedWith)
app.patch("/files/:id/unshare", async (req, res) => {
  try {
    const { userId } = req.body;
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

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
    const { name, owner, parentFolder } = req.body;
    if (!name || !owner)
      return res.status(400).json({ error: "Missing folder name or owner" });

    const folder = new Folder({
      name,
      owner,
      parentFolder: parentFolder || null,
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

    if (role === "admin" || role === "superadmin") {
      const folders = await Folder.find(query)
        .populate("owner", "email")
        .sort(sortOptions);
      return res.json(folders);
    }

    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // Get folders owned by user
    let ownedFolders = await Folder.find({ ...query, owner: userId })
      .populate("owner", "email")
      .sort(sortOptions);

    // If we have a parentFolder, check if user has access to it (for navigation within shared folders)
    if (parentFolder) {
      const parent = await Folder.findById(parentFolder);
      if (parent && (parent.owner.toString() === userId || parent.sharedWith.includes(userId))) {
        // User has access to parent folder, return ALL subfolders (not just owned by parent owner)
        // This allows users to see subfolders created by different users within shared folders
        const subFolders = await Folder.find(query) // Remove owner filter to get all subfolders
          .populate("owner", "email")
          .sort(sortOptions);

        ownedFolders = [...ownedFolders, ...subFolders];
      }
    } else {
      // Root level - include folders shared with user
      const sharedFolders = await Folder.find({
        ...query,
        owner: { $ne: userId },
        sharedWith: userId
      })
        .populate("owner", "email")
        .sort(sortOptions);

      ownedFolders = [...ownedFolders, ...sharedFolders];
    }

    // Remove duplicates
    const seenIds = new Set();
    const uniqueFolders = ownedFolders.filter(folder => {
      if (seenIds.has(folder._id.toString())) return false;
      seenIds.add(folder._id.toString());
      return true;
    });

    // Add owner and permission info for all folders
    const foldersWithPermissions = uniqueFolders.map(folder => {
      const isOwner = folder.owner._id.toString() === userId;
      return {
        ...folder.toObject(),
        isShared: !isOwner,
        permission: isOwner ? "owner" : (folder.permissions || "read"),
        ownerEmail: folder.owner?.email || null
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
    let folders = [];

    if (role === "admin" || role === "superadmin") {
      folders = await Folder.find({ deletedAt: null }).sort({ createdAt: -1 });
    } else {
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      // Get owned folders
      const ownedFolders = await Folder.find({ owner: userId, deletedAt: null }).sort({ createdAt: -1 });

      // Get shared folders
      const sharedFolders = await Folder.find({
        sharedWith: userId,
        deletedAt: null
      }).sort({ createdAt: -1 });

      folders = [...ownedFolders, ...sharedFolders];

      // Remove duplicates
      const seenIds = new Set();
      folders = folders.filter(folder => {
        if (seenIds.has(folder._id.toString())) return false;
        seenIds.add(folder._id.toString());
        return true;
      });
    }

    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Move folder
app.patch("/folders/:id/move", async (req, res) => {
  try {
    const { newFolderId, userId } = req.body;
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const oldFolderId = folder.parentFolder ? folder.parentFolder.toString() : null;
    const nextFolderId = newFolderId || null;
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

// Soft delete folder → moves to Trash
app.delete("/folders/:id", async (req, res) => {
  try {
    const folder = await Folder.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true }
    );
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    // NEW: log folder soft delete
    createLog("DELETE_FOLDER", folder.owner, `Moved to trash: ${folder.name}`);

    res.json({ status: "moved-to-trash", folder });
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

    const isAdmin = role === "admin" || role === "superadmin";
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
    const { emails, permission } = req.body;
    const users = await UserModel.find({ email: { $in: emails } });
    if (!users.length)
      return res.status(404).json({ error: "No matching users found" });

    const userIds = users.map((u) => u._id);
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    folder.sharedWith.push(...userIds);
    if (permission) folder.permissions = permission;

    await folder.save();
    await folder.populate("sharedWith", "email");

    // NEW: log folder share
    createLog("SHARE_FOLDER", folder.owner, `Shared folder ${folder.name} with ${emails.join(", ")}`);

    res.json({ status: "success", folder });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Unshare folder (remove user from sharedWith)
app.patch("/folders/:id/unshare", async (req, res) => {
  try {
    const { userId } = req.body;
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

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
                  permission: sharedFile.permission || "read",
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
                  permission: sharedFolder.permission || "read",
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
      permissions: f.permission || "read",
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
app.get("/search", async (req, res) => {
  try {
    const fs = require("fs");
    const { userId, query, type, date, q } = req.query;
    const searchTerm = query || q;

    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (!searchTerm) return res.json([]);

    // Search files
    let fileSearchQuery = { userId, deletedAt: null };

    // Search files by name
    const filesByName = await File.find({
      ...fileSearchQuery,
      originalName: { $regex: searchTerm, $options: "i" },
    }).populate("owner", "email");

    if (type) fileSearchQuery.mimetype = { $regex: type, $options: "i" };
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      fileSearchQuery.uploadDate = { $gte: start, $lte: end };
    }

    // Search inside file contents for text-based files
    const allFiles = await File.find(fileSearchQuery).populate("owner", "email");
    const filesWithContent = [];
    const searchLower = searchTerm.toLowerCase();

    for (const file of allFiles) {
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

      if (isTextFile) {
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

    // Search folders by name
    const foldersByName = await Folder.find({
      owner: userId,
      deletedAt: null,
      name: { $regex: searchTerm, $options: "i" },
    }).populate("owner", "email");

    // Combine files and folders
    const allFilesResult = [...filesByName, ...filesWithContent];
    const allFoldersResult = [...foldersByName];

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

    // Combine and sort all results (folders first, then files by date)
    const results = [
      ...uniqueFolders.map(folder => ({ ...folder.toObject(), isFolder: true })),
      ...uniqueFiles.map(file => ({ ...file.toObject(), isFile: true }))
    ].sort((a, b) => {
      // Folders come first
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;

      // Within same type, sort by date
      if (a.isFolder) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else {
        return new Date(b.uploadDate) - new Date(a.uploadDate);
      }
    });

    res.json(results);
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
    let fileQuery = { deletedAt: { $ne: null } };
    let folderQuery = { deletedAt: { $ne: null } };

    if (role !== "admin" && role !== "superadmin") {
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
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const isAdmin = role === "admin" || role === "superadmin";
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
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    const isAdmin = role === "admin" || role === "superadmin";
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

    // NEW: log restore folder
    createLog("RESTORE_FOLDER", folder.owner, `Restored folder ${folder.name}`);

    res.json({ status: "restored", folder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete file (Admin only)
app.delete("/trash/files/:id", async (req, res) => {
  try {
    const { role } = req.query;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Only admins can permanently delete files" });
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
    const { role } = req.query;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Only admins can permanently delete folders" });
    }

    const folder = await Folder.findByIdAndDelete(req.params.id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    // NEW: log permanent delete folder
    createLog("PERMANENT_DELETE_FOLDER", folder.owner, `Permanently deleted folder ${folder.name}`);

    res.json({ status: "permanently-deleted", folder });
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
    const users = await UserModel.find().sort({ createdAt: -1 }).lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  try {
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
    const { role } = req.body;
    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    // NEW: log role update
    createLog("UPDATE_ROLE", user._id, `Role changed to ${role}`);

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
    const { email, password, name, role } = req.body;

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
    if (role && !["user", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be 'user' or 'admin'" });
    }

    // Create new user
    const newUser = new UserModel({
      email,
      password, // Will be hashed by the model
      name: name || "",
      role: role || "user",
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
    const { users } = req.body;

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
        const userRole = user.role || "user";
        if (!["user", "admin"].includes(userRole)) {
          errors.push(`Row ${i + 1}: Invalid role '${userRole}'. Must be 'user' or 'admin'`);
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

    // Simple role counts - avoid aggregation issues
    const userRole = await UserModel.countDocuments({ role: "user" });
    const adminRole = await UserModel.countDocuments({ role: "admin" });
    const superAdminRole = await UserModel.countDocuments({ role: "superadmin" });

    const rolesCount = {
      user: userRole,
      admin: adminRole,
      superadmin: superAdminRole
    };

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
    const activeUsers = await UserModel.countDocuments({ active: true });
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
// ✅ RENAME FOLDER
app.put("/folders/:id/rename", async (req, res) => {
  try {
    const { id } = req.params;
    const { newName, userId } = req.body;

    if (!newName || !newName.trim())
      return res.status(400).json({ error: "Invalid name" });

    const folder = await Folder.findById(id);
    if (!folder) return res.status(404).json({ error: "Folder not found" });

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

    // ✅ Log rename action
    createLog("RENAME_FOLDER", userId || folder.owner, `Renamed folder to "${newName}"`);

    res.json(folder);
  } catch (err) {
    console.error("Rename folder error:", err);
    res.status(500).json({ error: "Failed to rename folder" });
  }
});


// ✅ RENAME FILE
app.put("/files/:id/rename", async (req, res) => {
  try {
    const { id } = req.params;
    const { newName, userId } = req.body;

    if (!newName || !newName.trim())
      return res.status(400).json({ error: "Invalid name" });

    const file = await File.findById(id);
    if (!file) return res.status(404).json({ error: "File not found" });

    const isOwner =
      file.owner?.toString?.() === userId ||
      file.userId?.toString?.() === userId;
    const isSharedWithWrite =
      file.sharedWith?.some(id => id.toString() === userId) &&
      file.permissions === "write";
    const isLeader = await isGroupLeaderForFile(userId, file._id);
    if (!isOwner && !isSharedWithWrite && !isLeader) {
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
    const { userIds } = req.body;

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
    const { userId, action } = req.body; // action: "add" or "remove"

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
      permission: permission || "read",
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

    res.json({ success: true, message: "Password change request submitted successfully" });
  } catch (err) {
    console.error("Password request error:", err);
    res.status(500).json({ error: "Failed to submit password change request" });
  }
});

// Get all password requests (Admin only)
app.get("/admin/password-requests", async (req, res) => {
  try {
    const { role } = req.query;

    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Admin access required" });
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
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      return res.status(403).json({ error: "Admin access required" });
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
      "You can now log in with your new password"
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
    if (!admin || (admin.role !== "admin" && admin.role !== "superadmin")) {
      return res.status(403).json({ error: "Admin access required" });
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
      "Please contact your administrator for more information"
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

// Get notifications for a user
app.get("/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
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

// Helper function to create notifications and send emails
async function createNotification(userId, type, title, message, details = "", relatedId = null, relatedModel = null) {
  try {
    // Create the notification in database
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      details,
      relatedId,
      relatedModel
    });

    await notification.save();

    // Get user email for sending notification email
    try {
      const user = await UserModel.findById(userId).select('email');
      if (user && user.email) {
        // Send email notification asynchronously (don't block on email sending)
        sendNotificationEmail(user.email, type, {
          userId,
          title,
          message,
          details,
          fileName: details,
          groupName: relatedModel === 'Group' ? 'Group' : null,
          sharerName: relatedModel === 'User' ? 'Administrator' : null,
          loginUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
        }).catch(emailErr => {
          console.error('Failed to send notification email:', emailErr);
          // Don't throw - email failure shouldn't break notification creation
        });
      }
    } catch (userErr) {
      console.error('Failed to get user email for notification:', userErr);
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
    const { query, userId, role, limit, searchType } = req.query;
    const searchTerm = query;

    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!searchTerm) return res.json([]);

    const limitNum = parseInt(limit) || 10;
    const results = [];

    // If searchType is 'all' or not specified, search everything
    // If searchType is specific, only search that type
    const shouldSearchUsers = !searchType || searchType === 'all' || searchType === 'user';
    const shouldSearchGroups = !searchType || searchType === 'all' || searchType === 'group';
    const shouldSearchLogs = !searchType || searchType === 'all' || searchType === 'log';
    const shouldSearchFiles = !searchType || searchType === 'all' || searchType === 'file';
    const shouldSearchFolders = !searchType || searchType === 'all' || searchType === 'folder';

    // Search users
    if (shouldSearchUsers) {
      const users = await UserModel.find({
        $or: [
          { name: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } }
        ]
      })
        .select("name email role createdAt active")
        .limit(limitNum);

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

    // Search groups
    if (shouldSearchGroups) {
      const groups = await Group.find({
        $or: [
          { name: { $regex: searchTerm, $options: "i" } },
          { description: { $regex: searchTerm, $options: "i" } }
        ]
      })
        .select("name description createdAt members")
        .limit(limitNum);

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

    // Search logs
    if (shouldSearchLogs) {
      const logs = await Log.find({
        $or: [
          { action: { $regex: searchTerm, $options: "i" } },
          { details: { $regex: searchTerm, $options: "i" } }
        ]
      })
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

    // Search files across ALL users (admin can see all files)
    if (shouldSearchFiles) {
      // Search files by name
      const filesByName = await File.find({
        originalName: { $regex: searchTerm, $options: "i" },
        deletedAt: null
      })
        .populate("owner", "email")
        .limit(limitNum);

      filesByName.forEach(file => {
        results.push({
          _id: file._id,
          type: "file",
          name: file.originalName,
          originalName: file.originalName,
          mimetype: file.mimetype,
          size: file.size,
          uploadDate: file.uploadDate,
          ownerEmail: file.owner?.email || null,
          path: file.parentFolder ? 'In folder' : 'Root'
        });
      });

      // Search inside file contents for text-based files
      const allFiles = await File.find({
        deletedAt: null
      })
        .populate("owner", "email")
        .limit(limitNum * 2);

      const searchLower = searchTerm.toLowerCase();
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
                results.push({
                  _id: file._id,
                  type: "file",
                  name: file.originalName,
                  originalName: file.originalName,
                  mimetype: file.mimetype,
                  size: file.size,
                  uploadDate: file.uploadDate,
                  ownerEmail: file.owner?.email || null,
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
                  results.push({
                    _id: file._id,
                    type: "file",
                    name: file.originalName,
                    originalName: file.originalName,
                    mimetype: file.mimetype,
                    size: file.size,
                    uploadDate: file.uploadDate,
                    ownerEmail: file.owner?.email || null,
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
                  results.push({
                    _id: file._id,
                    type: "file",
                    name: file.originalName,
                    originalName: file.originalName,
                    mimetype: file.mimetype,
                    size: file.size,
                    uploadDate: file.uploadDate,
                    ownerEmail: file.owner?.email || null,
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
                  results.push({
                    _id: file._id,
                    type: "file",
                    name: file.originalName,
                    originalName: file.originalName,
                    mimetype: file.mimetype,
                    size: file.size,
                    uploadDate: file.uploadDate,
                    ownerEmail: file.owner?.email || null,
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
      }
    }

    // Search folders across ALL users
    if (shouldSearchFolders) {
      const foldersByName = await Folder.find({
        deletedAt: null,
        name: { $regex: searchTerm, $options: "i" },
      })
        .populate("owner", "email")
        .limit(limitNum);

      foldersByName.forEach(folder => {
        results.push({
          _id: folder._id,
          type: "folder",
          name: folder.name,
          createdAt: folder.createdAt,
          ownerEmail: folder.owner?.email || null,
          path: folder.parentFolder ? 'In folder' : 'Root'
        });
      });
    }

    // Sort results - prioritize exact matches, then by date
    results.sort((a, b) => {
      const aName = a.name || a.action || "";
      const bName = b.name || b.action || "";
      const aExact = aName.toLowerCase() === searchTerm.toLowerCase();
      const bExact = bName.toLowerCase() === searchTerm.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Files and folders first, then users, groups, logs
      const typeOrder = { file: 0, folder: 0, user: 1, group: 2, log: 3 };
      const typeA = typeOrder[a.type] ?? 4;
      const typeB = typeOrder[b.type] ?? 4;
      if (typeA !== typeB) return typeA - typeB;
      
      const dateA = new Date(a.createdAt || a.date || a.uploadDate || 0);
      const dateB = new Date(b.createdAt || b.date || b.uploadDate || 0);
      return dateB - dateA;
    });

    res.json(results.slice(0, limitNum * 5));
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
  createLog("SYSTEM", null, `Server started on ${HOST}:${PORT}`);
});
