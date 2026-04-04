#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createRequire } = require("module");

const rootDir = path.resolve(__dirname, "..");
const serverDir = path.join(rootDir, "server");
const serverRequire = createRequire(path.join(serverDir, "package.json"));

serverRequire("dotenv").config({ path: path.join(serverDir, ".env") });

const mongoose = serverRequire("mongoose");
const PDFDocument = serverRequire("pdfkit");
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
} = serverRequire("docx");

const User = require(path.join(serverDir, "models", "users"));
const File = require(path.join(serverDir, "models", "file"));
const Folder = require(path.join(serverDir, "models", "folder"));
const Group = require(path.join(serverDir, "models", "group"));
const FileVersion = require(path.join(serverDir, "models", "fileversion"));
const Comment = require(path.join(serverDir, "models", "comment"));
const FormTemplate = require(path.join(serverDir, "models", "formtemplate"));
const Log = require(path.join(serverDir, "models", "logs"));
const PasswordRequest = require(path.join(serverDir, "models", "passwordrequest"));
const Notification = require(path.join(serverDir, "models", "notification"));
const AuthChallenge = require(path.join(serverDir, "models", "authchallenge"));
const AuditLog = require(path.join(serverDir, "models", "auditlogs"));

const BASE_URL = readArg("--base-url") || process.env.SEED_BASE_URL || "http://localhost:3001";
const MONGO_URI = process.env.MONGO_URI;
const PREFIX = "TCFTR";
const DEFAULT_PASSWORD = "TcFtr#2026";
const REGISTRATION_EMAIL = "new.test@llcc.edu.ph";
const REGISTRATION_CODE = "246810";
const PASSWORD_RESET_CODE = "135790";
const REQUEST_TIMEOUT_MS = 90000;

const seedDir = path.join(rootDir, ".qa-seed");
const uploadsDir = path.join(serverDir, "uploads");
const testDataDir = path.join(rootDir, "test-data");
const summaryPath = path.join(testDataDir, "seed-summary.json");

const now = new Date();

const userConfig = {
  superadmin: {
    email: "tcftr.superadmin@llcc.edu.ph",
    role: "superadmin",
    name: "TCFTR Super Admin",
    department: "COT",
    createdAt: daysAgo(120),
  },
  user1: {
    email: "tcftr.user1@llcc.edu.ph",
    role: "user",
    name: "TCFTR User One",
    department: "COT",
    createdAt: daysAgo(95),
  },
  user2: {
    email: "tcftr.user2@llcc.edu.ph",
    role: "user",
    name: "TCFTR User Two",
    department: "COED",
    createdAt: daysAgo(92),
  },
  deptChair: {
    email: "tcftr.deptchair@llcc.edu.ph",
    role: "dept_chair",
    name: "TCFTR Dept Chair",
    department: "COT",
    createdAt: daysAgo(90),
  },
  qaAdmin: {
    email: "tcftr.qa@llcc.edu.ph",
    role: "qa_admin",
    name: "TCFTR QA Admin",
    department: "COT",
    createdAt: daysAgo(88),
  },
  evaluator: {
    email: "tcftr.evaluator@llcc.edu.ph",
    role: "evaluator",
    name: "TCFTR Evaluator",
    department: "COHTM",
    createdAt: daysAgo(85),
  },
};

const assetPaths = {
  searchableV1: path.join(seedDir, "TCFTR-Searchable-v1.txt"),
  searchableV2: path.join(seedDir, "TCFTR-Searchable-v2.txt"),
  sharedEditable: path.join(seedDir, "TCFTR-Shared-Editable.txt"),
  dragFile: path.join(seedDir, "drag-file.txt"),
  duplicate1: path.join(seedDir, "TCFTR-Duplicate-1.txt"),
  duplicate2: path.join(seedDir, "TCFTR-Duplicate-2.txt"),
  analyticsNote: path.join(seedDir, "TCFTR-Analytics-Notes.txt"),
  genericPdf: path.join(seedDir, "tcftr-generic.pdf"),
  genericDocx: path.join(seedDir, "tcftr-generic.docx"),
  genericJpg: path.join(seedDir, "tcftr-image.jpg"),
  profilePng: path.join(seedDir, "tcftr-profile.png"),
  copcPdf: path.join(seedDir, "tcftr-copc-evidence.pdf"),
};

async function main() {
  if (!MONGO_URI) {
    throw new Error("Missing MONGO_URI in server/.env");
  }

  await ensureDir(seedDir);
  await ensureDir(uploadsDir);
  await ensureDir(testDataDir);
  await ensureAssets();

  await mongoose.connect(MONGO_URI);

  try {
    console.log("[seed] backend check");
    await ensureBackendReachable();

    console.log("[seed] users");
    const users = await ensureUsers();
    await ensureProfilePictures(users);
    await ensureDepartmentGroups(users);

    console.log("[seed] folders and files");
    const folders = await ensureUserFolders(users);
    const files = await ensureUserWorkspace(users, folders);

    console.log("[seed] groups");
    const groups = await ensureGroups(users, files);

    console.log("[seed] comments");
    const comments = await ensureComments(users, files);

    console.log("[seed] forms and reports");
    const forms = await ensureFormsAndReports(users, folders);

    console.log("[seed] notifications");
    await ensureNotifications(users, files, folders, groups, comments);

    console.log("[seed] auth and password requests");
    await ensurePasswordAndAuthCoverage(users);

    console.log("[seed] logs and audit");
    await ensureRecentAndAuditCoverage(users, files, folders);

    console.log("[seed] copc");
    const copc = await ensureCopcCoverage(users, folders, files);

    console.log("[seed] summary");

    const summary = await buildSummary({
      users,
      folders,
      files,
      groups,
      comments,
      forms,
      copc,
    });

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`Seed completed.`);
    console.log(`Summary: ${summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) {
    return String(process.argv[index + 1]).trim();
  }
  return "";
}

function daysAgo(days) {
  const value = new Date(now);
  value.setDate(value.getDate() - days);
  return value;
}

function daysFromNow(days) {
  const value = new Date(now);
  value.setDate(value.getDate() + days);
  return value;
}

function toId(value) {
  return value?._id?.toString?.() || value?.toString?.() || "";
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      values
        .map((value) => toId(value))
        .filter(Boolean)
    )
  );
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hashPassword(rawPassword) {
  const raw = String(rawPassword || "");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(raw, salt, 120000, 64, "sha512").toString("hex");
  return `pbkdf2_sha512$120000$${salt}$${hash}`;
}

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code || "")).digest("hex");
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function ensureAssets() {
  await fs.promises.writeFile(
    assetPaths.searchableV1,
    [
      "TCFTR Searchable Seed File",
      "ALPHA123 searchable content for content-search, editor, and recent activity tests.",
      "This version represents the initial upload baseline for version history coverage.",
      "Keywords: syllabus, compliance, curriculum, reviewer, analytics.",
    ].join("\n"),
    "utf8"
  );

  await fs.promises.writeFile(
    assetPaths.searchableV2,
    [
      "TCFTR Searchable Seed File",
      "ALPHA123 searchable content for content-search, editor, and recent activity tests.",
      "Seeded revision includes workflow checklist updates and document management notes.",
      "Editor update placeholder line.",
    ].join("\n"),
    "utf8"
  );

  await fs.promises.writeFile(
    assetPaths.sharedEditable,
    [
      "Shared editable coverage file.",
      "User2 can modify this file after editor sharing is granted.",
      "Initial state is ready for collaborative editing.",
    ].join("\n"),
    "utf8"
  );

  await fs.promises.writeFile(assetPaths.dragFile, "Drag-and-drop upload coverage file for the DocuDB seed.\n", "utf8");
  await fs.promises.writeFile(assetPaths.duplicate1, "DUPLICATE_HASH_CONTENT_001", "utf8");
  await fs.promises.writeFile(assetPaths.duplicate2, "DUPLICATE_HASH_CONTENT_001", "utf8");
  await fs.promises.writeFile(
    assetPaths.analyticsNote,
    [
      "General note for analytics and smart notification coverage.",
      "This file intentionally avoids strong classification keywords.",
      "Review manually if confidence stays low.",
    ].join("\n"),
    "utf8"
  );

  await createPdf(assetPaths.genericPdf, "TCFTR Policy Reference", [
    "Policy preview and download coverage for test cases.",
    "This document contains compliance and governance notes.",
    `Generated: ${now.toISOString().slice(0, 10)}`,
  ]);

  await createPdf(assetPaths.copcPdf, "TCFTR COPC Evidence", [
    "Evidence package used for COPC workflow coverage.",
    "Supports department chair review, QA review, observations, and package compilation.",
    `Generated: ${now.toISOString().slice(0, 10)}`,
  ]);

  await createDocx(assetPaths.genericDocx, "TCFTR Report Document", [
    "This DOCX file is used for upload, download, move, and group-sharing coverage.",
    "It contains enough text for extraction and preview tests.",
    "Generated by the reusable test-case seed script.",
  ]);

  await fs.promises.writeFile(assetPaths.genericJpg, tinyJpegBuffer());
  await fs.promises.writeFile(assetPaths.profilePng, tinyPngBuffer());
}

async function createPdf(filePath, title, lines) {
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.pipe(stream);
    doc.fontSize(20).text(title, { align: "center" });
    doc.moveDown();
    for (const line of lines) {
      doc.fontSize(11).text(String(line || ""), { align: "left" });
      doc.moveDown(0.6);
    }
    doc.end();
  });
}

async function createDocx(filePath, title, lines) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          ...lines.map((line) => new Paragraph(String(line || ""))),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  await fs.promises.writeFile(filePath, buffer);
}

function tinyPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=",
    "base64"
  );
}

function tinyJpegBuffer() {
  return Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUSEhIVFRUVFRUVFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGzclHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBEQACEQEDEQH/xAAVAAEBAAAAAAAAAAAAAAAAAAAAAf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAJ8P/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAgEBPwF//9k=",
    "base64"
  );
}

async function ensureBackendReachable() {
  const response = await fetch(`${BASE_URL}/`);
  if (!response.ok) {
    throw new Error(`Backend is not reachable at ${BASE_URL}`);
  }
}

async function apiJson(pathname, options = {}) {
  const { method = "GET", query, body, formData, expectedStatuses } = options;
  const url = new URL(pathname, BASE_URL);
  for (const [key, value] of Object.entries(query || {})) {
    if (typeof value === "undefined" || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const requestInit = { method, headers: {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  requestInit.signal = controller.signal;
  if (formData) {
    requestInit.body = formData;
  } else if (typeof body !== "undefined") {
    requestInit.headers["Content-Type"] = "application/json";
    requestInit.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, requestInit);
  } finally {
    clearTimeout(timer);
  }
  const rawText = await response.text();
  const parsed = rawText ? tryParseJson(rawText) : null;
  const accepted = Array.isArray(expectedStatuses)
    ? expectedStatuses
    : response.ok
      ? [response.status]
      : [];

  if (!accepted.includes(response.status)) {
    const details =
      typeof parsed === "string"
        ? parsed
        : parsed?.error || parsed?.message || rawText || `HTTP ${response.status}`;
    const error = new Error(details);
    error.status = response.status;
    error.data = parsed;
    throw error;
  }

  return parsed;
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function uploadFile(params) {
  const {
    filePath,
    originalName,
    mimeType,
    userId,
    role,
    parentFolder,
    isUpdate = false,
    fileId = "",
    changeDescription = "",
  } = params;

  const blob = new Blob([await fs.promises.readFile(filePath)], { type: mimeType });
  const form = new FormData();
  form.append("file", blob, originalName);
  form.append("userId", String(userId));
  form.append("role", String(role));
  if (parentFolder) form.append("parentFolder", String(parentFolder));
  if (isUpdate) form.append("isUpdate", "true");
  if (fileId) form.append("fileId", String(fileId));
  if (changeDescription) form.append("changeDescription", changeDescription);

  const data = await apiJson("/upload", {
    method: "POST",
    formData: form,
    expectedStatuses: [200],
  });
  return data?.file || data;
}

async function ensureUsers() {
  const users = {};

  for (const [key, config] of Object.entries(userConfig)) {
    let user = await User.findOne({
      email: new RegExp(`^${escapeRegex(config.email)}$`, "i"),
    });

    if (!user) {
      user = new User({
        email: config.email.toLowerCase(),
        password: hashPassword(DEFAULT_PASSWORD),
        name: config.name,
        department: config.department,
        role: config.role,
        active: true,
        createdAt: config.createdAt,
      });
    } else {
      user.email = config.email.toLowerCase();
      user.password = hashPassword(DEFAULT_PASSWORD);
      user.name = config.name;
      user.department = config.department;
      user.role = config.role;
      user.active = true;
      if (!user.createdAt) {
        user.createdAt = config.createdAt;
      }
    }

    await user.save();
    users[key] = user;
  }

  return users;
}

async function ensureProfilePictures(users) {
  const assignments = [
    { user: users.user1, filename: "tcftr-user1-profile.png" },
    { user: users.deptChair, filename: "tcftr-deptchair-profile.png" },
  ];

  for (const entry of assignments) {
    const targetPath = path.join(uploadsDir, entry.filename);
    if (!fs.existsSync(targetPath)) {
      await fs.promises.copyFile(assetPaths.profilePng, targetPath);
    }
    entry.user.profilePicture = entry.filename;
    await entry.user.save();
    await ensureLogOnce(
      entry.user._id,
      "PROFILE_PICTURE_UPDATE",
      `Seeded profile picture for ${entry.user.email}`,
      daysAgo(6)
    );
  }
}

async function ensureDepartmentGroups(users) {
  const byDepartment = {
    COT: [users.superadmin, users.user1, users.deptChair, users.qaAdmin],
    COED: [users.user2],
    COHTM: [users.evaluator],
  };

  for (const [code, members] of Object.entries(byDepartment)) {
    let group = await Group.findOne({ name: new RegExp(`^${escapeRegex(code)}$`, "i") });
    if (!group) {
      group = new Group({
        name: code,
        description: `Department group for ${code}`,
        createdBy: users.superadmin._id,
        members: [],
        leaders: [],
        notifications: [],
        announcements: [],
        sharedFiles: [],
        sharedFolders: [],
      });
    }

    group.description = `Department group for ${code}`;
    group.members = uniqueStrings([...(group.members || []), ...members.map((user) => user._id)]);
    await group.save();
  }
}

async function ensureUserFolders(users) {
  const rootFolder = await ensureFolder({
    name: `${PREFIX} Root`,
    owner: users.user1._id,
    parentFolder: null,
  });
  const sharedFolder = await ensureFolder({
    name: `${PREFIX} Shared Target`,
    owner: users.user1._id,
    parentFolder: rootFolder._id,
  });
  const moveTargetFolder = await ensureFolder({
    name: `${PREFIX} Move Target`,
    owner: users.user1._id,
    parentFolder: rootFolder._id,
  });
  const deepArchiveFolder = await ensureFolder({
    name: `${PREFIX} Deep Archive`,
    owner: users.user1._id,
    parentFolder: sharedFolder._id,
  });
  const semesterFolder = await ensureFolder({
    name: `${PREFIX} Semester 2 Archive`,
    owner: users.user1._id,
    parentFolder: deepArchiveFolder._id,
  });
  const folderMoveCandidate = await ensureFolder({
    name: `${PREFIX} Archive Candidate`,
    owner: users.user1._id,
    parentFolder: rootFolder._id,
  });
  const trashFolder = await ensureFolder({
    name: `${PREFIX} Trash Folder`,
    owner: users.user1._id,
    parentFolder: rootFolder._id,
  });

  return {
    rootFolder,
    sharedFolder,
    moveTargetFolder,
    deepArchiveFolder,
    semesterFolder,
    folderMoveCandidate,
    trashFolder,
  };
}

async function ensureFolder({ name, owner, parentFolder }) {
  let folder = await Folder.findOne({
    name,
    owner,
    parentFolder: parentFolder || null,
  }).sort({ createdAt: 1 });

  if (!folder) {
    folder = new Folder({
      name,
      owner,
      parentFolder: parentFolder || null,
      permissions: "owner",
      sharedWith: [],
      deletedAt: null,
      createdAt: daysAgo(60),
    });
  }

  folder.name = name;
  folder.owner = owner;
  folder.parentFolder = parentFolder || null;
  folder.deletedAt = null;
  if (!folder.createdAt) folder.createdAt = daysAgo(60);
  await folder.save();
  return folder;
}

async function ensureUserWorkspace(users, folders) {
  const files = {};
  const userId = toId(users.user1);

  files.searchable = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Searchable.txt`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "text/plain",
    assetPath: assetPaths.searchableV1,
    validTest: () => true,
  });

  let searchableVersionCount = await FileVersion.countDocuments({ fileId: files.searchable._id });
  if (searchableVersionCount < 2) {
    await uploadFile({
      filePath: assetPaths.searchableV2,
      originalName: `${PREFIX}-Searchable.txt`,
      mimeType: "text/plain",
      userId,
      role: "user",
      parentFolder: folders.rootFolder._id,
      isUpdate: true,
      fileId: files.searchable._id,
      changeDescription: "Seeded revision: updated searchable baseline",
    });
    files.searchable = await File.findById(files.searchable._id);
  }

  searchableVersionCount = await FileVersion.countDocuments({ fileId: files.searchable._id });
  if (searchableVersionCount < 3) {
    const currentPath = path.join(uploadsDir, files.searchable.filename);
    const currentContent = fs.existsSync(currentPath)
      ? fs.readFileSync(currentPath, "utf8")
      : "";
    const appended = currentContent.includes("Editor update from seeded test data.")
      ? currentContent
      : `${currentContent.trim()}\nEditor update from seeded test data.\n`;
    await apiJson(`/files/${files.searchable._id}/content`, {
      method: "PATCH",
      body: {
        userId,
        role: "user",
        content: appended,
        changeDescription: "Seeded editor update",
      },
      expectedStatuses: [200],
    });
    files.searchable = await File.findById(files.searchable._id);
  }

  files.policyPdf = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Policy.pdf`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "application/pdf",
    assetPath: assetPaths.genericPdf,
    validTest: (file) => hasMagic(path.join(uploadsDir, file.filename), "pdf"),
  });

  files.reportDocx = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Report.docx`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    assetPath: assetPaths.genericDocx,
    validTest: (file) => hasMagic(path.join(uploadsDir, file.filename), "zip"),
  });

  files.imageJpg = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Image.jpg`,
    owner: users.user1,
    parentFolder: folders.sharedFolder,
    mimeType: "image/jpeg",
    assetPath: assetPaths.genericJpg,
    validTest: (file) => hasMagic(path.join(uploadsDir, file.filename), "jpg"),
  });

  files.dragFile = await ensureWorkspaceFile({
    originalName: "drag-file.txt",
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "text/plain",
    assetPath: assetPaths.dragFile,
    validTest: () => true,
  });

  files.duplicate1 = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Duplicate-1.txt`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "text/plain",
    assetPath: assetPaths.duplicate1,
    validTest: () => true,
  });

  files.duplicate2 = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Duplicate-2.txt`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "text/plain",
    assetPath: assetPaths.duplicate2,
    validTest: () => true,
  });

  files.sharedEditable = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Shared-Editable.txt`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "text/plain",
    assetPath: assetPaths.sharedEditable,
    validTest: () => true,
  });

  files.analyticsNote = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Analytics-Notes.txt`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "text/plain",
    assetPath: assetPaths.analyticsNote,
    validTest: () => true,
  });

  files.moveCandidate = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Move-Candidate.docx`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    assetPath: assetPaths.genericDocx,
    validTest: (file) => hasMagic(path.join(uploadsDir, file.filename), "zip"),
  });

  files.renameCandidate = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Rename-Candidate.pdf`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "application/pdf",
    assetPath: assetPaths.genericPdf,
    validTest: (file) => hasMagic(path.join(uploadsDir, file.filename), "pdf"),
  });

  files.trashFile = await ensureWorkspaceFile({
    originalName: `${PREFIX}-Trash-File.pdf`,
    owner: users.user1,
    parentFolder: folders.rootFolder,
    mimeType: "application/pdf",
    assetPath: assetPaths.genericPdf,
    validTest: (file) => hasMagic(path.join(uploadsDir, file.filename), "pdf"),
  });

  await ensureFavoritePinned(files.searchable, users.user1);
  await ensureFileShare(files.policyPdf, users.user1, users.user2.email, "viewer");
  await ensureFileShare(files.sharedEditable, users.user1, users.user2.email, "editor");
  await ensureFolderShare(folders.sharedFolder, users.user1, users.user2.email, "editor");
  await ensureUser2SharedEdit(files.sharedEditable, users.user2);

  await ensureMovedFile(files.moveCandidate, folders.moveTargetFolder, users.user1);
  files.moveCandidate = await findActiveFile({
    originalName: `${PREFIX}-Move-Candidate.docx`,
    owner: users.user1._id,
    parentFolder: folders.moveTargetFolder._id,
  });

  await ensureRenamedFile(files.renameCandidate, `${PREFIX}-Renamed-Archive.pdf`, users.user1);
  files.renamedArchive = await findActiveFile({
    originalName: `${PREFIX}-Renamed-Archive.pdf`,
    owner: users.user1._id,
  });

  await ensureMovedAndRenamedFolder(folders, users.user1);
  folders.folderMoveCandidate = await Folder.findOne({
    name: `${PREFIX} Archive Candidate A`,
    owner: users.user1._id,
    parentFolder: folders.sharedFolder._id,
    deletedAt: null,
  });

  await ensureTrashedFile(files.trashFile, users.superadmin);
  files.trashFile = await File.findById(files.trashFile._id);

  await ensureTrashedFolder(folders.trashFolder, users.superadmin);
  folders.trashFolder = await Folder.findById(folders.trashFolder._id);

  return files;
}

async function ensureWorkspaceFile(params) {
  const { originalName, owner, parentFolder, mimeType, assetPath, validTest } = params;
  let file = await findActiveFile({
    originalName,
    owner: owner._id,
    parentFolder: parentFolder._id,
  });

  if (!file) {
    await uploadFile({
      filePath: assetPath,
      originalName,
      mimeType,
      userId: owner._id,
      role: "user",
      parentFolder: parentFolder._id,
    });
    file = await findActiveFile({
      originalName,
      owner: owner._id,
      parentFolder: parentFolder._id,
    });
  } else if (typeof validTest === "function" && !validTest(file)) {
    await uploadFile({
      filePath: assetPath,
      originalName,
      mimeType,
      userId: owner._id,
      role: "user",
      parentFolder: parentFolder._id,
      isUpdate: true,
      fileId: file._id,
      changeDescription: "Seed refreshed with valid binary fixture",
    });
    file = await File.findById(file._id);
  }

  return file;
}

async function findActiveFile(query) {
  return File.findOne({
    originalName: query.originalName,
    owner: query.owner,
    deletedAt: null,
    ...(typeof query.parentFolder === "undefined"
      ? {}
      : { parentFolder: query.parentFolder || null }),
  }).sort({ uploadDate: 1 });
}

function hasMagic(filePath, kind) {
  if (!fs.existsSync(filePath)) return false;
  const chunk = fs.readFileSync(filePath);
  if (kind === "pdf") return chunk.slice(0, 4).toString("utf8") === "%PDF";
  if (kind === "zip") return chunk[0] === 0x50 && chunk[1] === 0x4b;
  if (kind === "jpg") return chunk[0] === 0xff && chunk[1] === 0xd8 && chunk[2] === 0xff;
  return true;
}

async function ensureFavoritePinned(file, user) {
  const refreshed = await File.findById(file._id).select("favoritedBy pinnedBy");
  const userId = toId(user);
  const isFavorite = (refreshed.favoritedBy || []).map(String).includes(userId);
  const isPinned = (refreshed.pinnedBy || []).map(String).includes(userId);

  if (!isFavorite) {
    await apiJson(`/files/${file._id}/favorite`, {
      method: "PATCH",
      body: { userId, role: "user", favorited: true },
      expectedStatuses: [200],
    });
  }

  if (!isPinned) {
    await apiJson(`/files/${file._id}/pin`, {
      method: "PATCH",
      body: { userId, role: "user", pinned: true },
      expectedStatuses: [200],
    });
  }
}

async function ensureFileShare(file, ownerUser, targetEmail, permission) {
  const target = await User.findOne({ email: new RegExp(`^${escapeRegex(targetEmail)}$`, "i") }).select("_id");
  const refreshed = await File.findById(file._id).select("sharedWith permissions");
  const alreadyShared = (refreshed.sharedWith || []).map(String).includes(toId(target));
  const samePermission = String(refreshed.permissions || "") === permission;
  if (alreadyShared && samePermission) return;

  await apiJson(`/files/${file._id}/share`, {
    method: "PATCH",
    body: {
      emails: [targetEmail],
      permission,
      userId: toId(ownerUser),
      role: "user",
    },
    expectedStatuses: [200],
  });
}

async function ensureFolderShare(folder, ownerUser, targetEmail, permission) {
  const target = await User.findOne({ email: new RegExp(`^${escapeRegex(targetEmail)}$`, "i") }).select("_id");
  const refreshed = await Folder.findById(folder._id).select("sharedWith permissions");
  const alreadyShared = (refreshed.sharedWith || []).map(String).includes(toId(target));
  const samePermission = String(refreshed.permissions || "") === permission;
  if (alreadyShared && samePermission) return;

  await apiJson(`/folders/${folder._id}/share`, {
    method: "PATCH",
    body: {
      emails: [targetEmail],
      permission,
      userId: toId(ownerUser),
      role: "user",
    },
    expectedStatuses: [200],
  });
}

async function ensureUser2SharedEdit(file, user2) {
  const versionCount = await FileVersion.countDocuments({ fileId: file._id });
  if (versionCount >= 2) return;

  const filePath = path.join(uploadsDir, file.filename);
  const currentContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const updatedContent = currentContent.includes("Edited by TCFTR User Two")
    ? currentContent
    : `${currentContent.trim()}\nEdited by TCFTR User Two during shared editor seed coverage.\n`;

  await apiJson(`/files/${file._id}/content`, {
    method: "PATCH",
    body: {
      userId: toId(user2),
      role: "user",
      content: updatedContent,
      changeDescription: "Seeded shared editor update by user2",
    },
    expectedStatuses: [200],
  });
}

async function ensureMovedFile(file, targetFolder, ownerUser) {
  const refreshed = await File.findById(file._id).select("parentFolder");
  if (String(refreshed.parentFolder || "") === String(targetFolder._id)) return;

  await apiJson(`/files/${file._id}/move`, {
    method: "PATCH",
    body: {
      newFolderId: String(targetFolder._id),
      userId: toId(ownerUser),
      role: "user",
    },
    expectedStatuses: [200],
  });
}

async function ensureRenamedFile(file, finalName, ownerUser) {
  const existingFinal = await findActiveFile({
    originalName: finalName,
    owner: ownerUser._id,
  });
  if (existingFinal) return;

  const refreshed = await File.findById(file._id).select("originalName");
  if (refreshed && refreshed.originalName === finalName) return;

  await apiJson(`/files/${file._id}/rename`, {
    method: "PUT",
    body: {
      newName: finalName,
      userId: toId(ownerUser),
      role: "user",
    },
    expectedStatuses: [200],
  });
}

async function ensureMovedAndRenamedFolder(folders, ownerUser) {
  const alreadyFinal = await Folder.findOne({
    name: `${PREFIX} Archive Candidate A`,
    owner: ownerUser._id,
    parentFolder: folders.sharedFolder._id,
    deletedAt: null,
  });
  if (alreadyFinal) return;

  let folder = await Folder.findOne({
    name: `${PREFIX} Archive Candidate`,
    owner: ownerUser._id,
    parentFolder: folders.rootFolder._id,
    deletedAt: null,
  });

  if (!folder) {
    folder = await ensureFolder({
      name: `${PREFIX} Archive Candidate`,
      owner: ownerUser._id,
      parentFolder: folders.rootFolder._id,
    });
  }

  if (folder.name !== `${PREFIX} Archive Candidate A`) {
    await apiJson(`/folders/${folder._id}/rename`, {
      method: "PUT",
      body: {
        newName: `${PREFIX} Archive Candidate A`,
        userId: toId(ownerUser),
        role: "user",
      },
      expectedStatuses: [200],
    });
  }

  folder = await Folder.findById(folder._id);
  if (String(folder.parentFolder || "") !== String(folders.sharedFolder._id)) {
    await apiJson(`/folders/${folder._id}/move`, {
      method: "PATCH",
      body: {
        newFolderId: String(folders.sharedFolder._id),
        userId: toId(ownerUser),
        role: "user",
      },
      expectedStatuses: [200],
    });
  }
}

async function ensureTrashedFile(file, adminUser) {
  const refreshed = await File.findById(file._id).select("deletedAt");
  if (refreshed.deletedAt) return;

  await apiJson(`/files/${file._id}`, {
    method: "DELETE",
    query: {
      userId: toId(adminUser),
      role: "superadmin",
    },
    expectedStatuses: [200],
  });
}

async function ensureTrashedFolder(folder, adminUser) {
  const refreshed = await Folder.findById(folder._id).select("deletedAt");
  if (refreshed.deletedAt) return;

  await apiJson(`/folders/${folder._id}`, {
    method: "DELETE",
    query: {
      userId: toId(adminUser),
      role: "superadmin",
    },
    expectedStatuses: [200],
  });
}

async function ensureGroups(users, files) {
  const collaborationGroup = await ensureGroup({
    name: `${PREFIX} Collaboration Group`,
    description: "Test collaboration group for feature test cases and shared resource coverage.",
    createdBy: users.superadmin._id,
  });
  await ensureGroupMembers(collaborationGroup, [users.user1, users.user2, users.deptChair], users.superadmin);
  await ensureGroupLeader(collaborationGroup, users.deptChair, users.superadmin);
  await ensureGroupNotification(
    collaborationGroup,
    "TCFTR Weekly Sync",
    "Please review the shared compliance bundle before Friday.",
    users.superadmin
  );
  await ensureGroupAnnouncement(
    collaborationGroup,
    "TCFTR Collaboration Window",
    "Seeded announcement for group collaboration, member visibility, and detail page coverage.",
    users.deptChair
  );
  await ensureGroupShare(collaborationGroup, "file", files.reportDocx._id, "viewer", users.user1);

  const adminGroup = await ensureGroup({
    name: `${PREFIX} Admin Group`,
    description: "Updated admin review group for governance and management coverage.",
    createdBy: users.superadmin._id,
  });
  await ensureGroupMembers(adminGroup, [users.superadmin, users.qaAdmin, users.deptChair], users.superadmin);
  await ensureGroupLeader(adminGroup, users.qaAdmin, users.superadmin);

  return { collaborationGroup, adminGroup };
}

async function ensureGroup({ name, description, createdBy }) {
  let group = await Group.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
  if (!group) {
    const response = await apiJson("/groups", {
      method: "POST",
      body: { name, description, createdBy: String(createdBy) },
      expectedStatuses: [200],
    });
    group = response.group;
  }

  if (String(group.description || "") !== String(description || "")) {
    const response = await apiJson(`/groups/${group._id}`, {
      method: "PATCH",
      body: { name, description },
      expectedStatuses: [200],
    });
    group = response.group;
  }

  return Group.findById(group._id);
}

async function ensureGroupMembers(group, usersToAdd, actor) {
  const refreshed = await Group.findById(group._id).select("members");
  const existing = new Set((refreshed.members || []).map((value) => String(value)));
  const missing = usersToAdd.map((user) => toId(user)).filter((id) => !existing.has(id));
  if (!missing.length) return;

  await apiJson(`/groups/${group._id}/members`, {
    method: "PATCH",
    body: { userIds: missing, actorId: toId(actor) },
    expectedStatuses: [200],
  });
}

async function ensureGroupLeader(group, leaderUser, actor) {
  const refreshed = await Group.findById(group._id).select("leaders");
  const leaders = (refreshed.leaders || []).map((value) => String(value));
  if (leaders.includes(toId(leaderUser))) return;

  await apiJson(`/groups/${group._id}/leaders`, {
    method: "PATCH",
    body: { userId: toId(leaderUser), action: "add", actorId: toId(actor) },
    expectedStatuses: [200],
  });
}

async function ensureGroupNotification(group, title, message, createdBy) {
  const refreshed = await Group.findById(group._id).select("notifications");
  const exists = (refreshed.notifications || []).some(
    (entry) => entry.title === title && entry.message === message
  );
  if (exists) return;

  await apiJson(`/groups/${group._id}/notifications`, {
    method: "POST",
    body: { title, message, createdBy: toId(createdBy) },
    expectedStatuses: [200],
  });
}

async function ensureGroupAnnouncement(group, title, content, createdBy) {
  const refreshed = await Group.findById(group._id).select("announcements");
  const exists = (refreshed.announcements || []).some(
    (entry) => entry.title === title && entry.content === content
  );
  if (exists) return;

  await apiJson(`/groups/${group._id}/announcements`, {
    method: "POST",
    body: { title, content, createdBy: toId(createdBy) },
    expectedStatuses: [200],
  });
}

async function ensureGroupShare(group, type, itemId, permission, sharedBy) {
  const refreshed = await Group.findById(group._id).select("sharedFiles sharedFolders");
  const exists =
    type === "file"
      ? (refreshed.sharedFiles || []).some((entry) => String(entry.fileId) === String(itemId))
      : (refreshed.sharedFolders || []).some((entry) => String(entry.folderId) === String(itemId));
  if (exists) return;

  await apiJson(`/groups/${group._id}/share`, {
    method: "PATCH",
    body: { type, itemId: String(itemId), permission, sharedBy: toId(sharedBy) },
    expectedStatuses: [200],
  });
}

async function ensureComments(users, files) {
  const rootCommentText = `${PREFIX} root comment seed`;
  let rootComment = await Comment.findOne({
    itemId: files.searchable._id,
    itemType: "file",
    content: rootCommentText,
    parentCommentId: null,
  }).sort({ createdAt: 1 });

  if (!rootComment) {
    rootComment = await apiJson("/comments", {
      method: "POST",
      body: {
        itemId: String(files.searchable._id),
        itemType: "file",
        content: rootCommentText,
        createdBy: toId(users.user2),
      },
      expectedStatuses: [200],
    });
  }

  const replyText = `${PREFIX} reply seed`;
  const existingReply = await Comment.findOne({
    parentCommentId: rootComment._id,
    content: replyText,
  });
  if (!existingReply) {
    await apiJson("/comments", {
      method: "POST",
      body: {
        itemId: String(files.searchable._id),
        itemType: "file",
        content: replyText,
        createdBy: toId(users.user1),
        parentCommentId: String(rootComment._id),
      },
      expectedStatuses: [200],
    });
  }

  let editableComment = await Comment.findOne({
    itemId: files.searchable._id,
    itemType: "file",
    parentCommentId: null,
    content: `${PREFIX} editable comment seed`,
  });
  if (!editableComment) {
    editableComment = await apiJson("/comments", {
      method: "POST",
      body: {
        itemId: String(files.searchable._id),
        itemType: "file",
        content: `${PREFIX} editable comment seed`,
        createdBy: toId(users.user2),
      },
      expectedStatuses: [200],
    });
  }

  const targetEditedText = `${PREFIX} editable comment seed updated`;
  const refreshedEditable = await Comment.findById(editableComment._id).select("content");
  if (String(refreshedEditable.content || "") !== targetEditedText) {
    await apiJson(`/comments/${editableComment._id}`, {
      method: "PATCH",
      body: { content: targetEditedText },
      expectedStatuses: [200],
    });
  }

  const reply = await Comment.findOne({ parentCommentId: rootComment._id, content: replyText });
  const edited = await Comment.findById(editableComment._id);
  return { rootComment: await Comment.findById(rootComment._id), reply, editedComment: edited };
}

async function ensureFormsAndReports(users, folders) {
  let template = await FormTemplate.findOne({
    name: `${PREFIX} Template A`,
    owner: users.user1._id,
  });

  if (!template) {
    const response = await apiJson("/form-templates", {
      method: "POST",
      body: {
        userId: toId(users.user1),
        role: "user",
        name: `${PREFIX} Template A`,
        description: "Seeded smart form template for generation coverage.",
        fields: [
          { key: "title", label: "Title", type: "text", required: true, placeholder: "Document title" },
          { key: "owner", label: "Owner", type: "text", required: true, placeholder: "Owner" },
          { key: "summary", label: "Summary", type: "textarea", required: true, placeholder: "Summary" },
        ],
        templateBody: "Title: {{title}}\nOwner: {{owner}}\nSummary:\n{{summary}}",
        outputType: "docx",
        destinationFolder: String(folders.rootFolder._id),
      },
      expectedStatuses: [200],
    });
    template = response.template;
  }

  let generatedFile = await File.findOne({
    owner: users.user1._id,
    originalName: { $regex: `^${escapeRegex(PREFIX)}_Template_A_`, $options: "i" },
    deletedAt: null,
  }).sort({ uploadDate: -1 });

  if (!generatedFile) {
    const response = await apiJson(`/form-templates/${template._id}/generate`, {
      method: "POST",
      body: {
        userId: toId(users.user1),
        role: "user",
        values: {
          title: "TCFTR Generated Memo",
          owner: "TCFTR User One",
          summary: "Generated from seeded template data to support forms and document generation coverage.",
        },
        destinationFolder: String(folders.rootFolder._id),
      },
      expectedStatuses: [200],
    });
    generatedFile = response.file;
  }

  let autoReport = await File.findOne({
    originalName: { $regex: "^TCFTR_Compliance_Snapshot_", $options: "i" },
    deletedAt: null,
  }).sort({ uploadDate: -1 });

  if (!autoReport) {
    const response = await apiJson("/reports/auto-generate", {
      method: "POST",
      body: {
        userId: toId(users.qaAdmin),
        role: "qa_admin",
        reportData: {
          reportTitle: "TCFTR Compliance Snapshot",
          outputType: "pdf",
          destinationFolder: String(folders.rootFolder._id),
          programName: "TCFTR COPC Program",
          summary: "Seeded auto-generated report coverage.",
          metrics: [
            { label: "Approved", value: "1" },
            { label: "Rejected", value: "2" },
            { label: "Pending", value: "1" },
          ],
        },
      },
      expectedStatuses: [200],
    });
    autoReport = response.file;
  }

  return {
    template: await FormTemplate.findById(template._id),
    generatedFile: await File.findById(generatedFile._id || generatedFile),
    autoReport: await File.findById(autoReport._id || autoReport),
  };
}

async function ensureNotifications(users, files, folders, groups, comments) {
  const user2Id = toId(users.user2);
  const hasSampleTestNotifications = await Notification.countDocuments({
    userId: user2Id,
    type: { $in: ["SHARE_FILE", "PASSWORD_CHANGE_REQUEST", "COMMENT", "UPLOAD"] },
    title: { $in: ["File Shared", "Password Change Request", "New Comment", "New Upload"] },
  });

  if (hasSampleTestNotifications < 4) {
    await apiJson(`/notifications/test/${user2Id}`, {
      method: "POST",
      body: {},
      expectedStatuses: [200],
    });
  }

  await apiJson(`/notifications/smart/${user2Id}`, {
    method: "POST",
    body: {},
    expectedStatuses: [200],
  });

  const firstUnread = await Notification.findOne({ userId: user2Id, isRead: false }).sort({ createdAt: 1 });
  if (firstUnread) {
    await apiJson(`/notifications/${firstUnread._id}/read`, {
      method: "PATCH",
      body: {},
      expectedStatuses: [200],
    });
  }

  await ensureNotificationOnce({
    userId: users.user1._id,
    actorId: users.user2._id,
    type: "COMMENT",
    title: "Seeded comment thread",
    message: `A seeded comment thread is available on "${files.searchable.originalName}".`,
    details: comments.rootComment.content,
    relatedId: files.searchable._id,
    relatedModel: "File",
    metadata: { itemType: "file", itemLabel: files.searchable.originalName },
  });

  await ensureNotificationOnce({
    userId: users.user2._id,
    actorId: users.superadmin._id,
    type: "ACTION_REQUIRED",
    title: "Review seeded shared content",
    message: `Open "${folders.sharedFolder.name}" and "${groups.collaborationGroup.name}" to review shared resources.`,
    details: files.sharedEditable.originalName,
    relatedId: folders.sharedFolder._id,
    relatedModel: "Folder",
    metadata: { folderName: folders.sharedFolder.name },
  });
}

async function ensurePasswordAndAuthCoverage(users) {
  const authExpiry = daysFromNow(10);

  await AuthChallenge.updateMany(
    { email: REGISTRATION_EMAIL.toLowerCase(), purpose: "registration", consumedAt: null },
    { $set: { consumedAt: now } }
  );
  await AuthChallenge.create({
    userId: null,
    email: REGISTRATION_EMAIL.toLowerCase(),
    purpose: "registration",
    codeHash: hashCode(REGISTRATION_CODE),
    expiresAt: authExpiry,
    attemptCount: 0,
    consumedAt: null,
    createdAt: now,
  });

  await AuthChallenge.updateMany(
    { email: users.user1.email.toLowerCase(), purpose: "password_reset", consumedAt: null },
    { $set: { consumedAt: now } }
  );
  await AuthChallenge.create({
    userId: users.user1._id,
    email: users.user1.email.toLowerCase(),
    purpose: "password_reset",
    codeHash: hashCode(PASSWORD_RESET_CODE),
    expiresAt: authExpiry,
    attemptCount: 0,
    consumedAt: null,
    createdAt: now,
  });

  await ensurePasswordRequest({
    user: users.user2,
    admin: null,
    status: "pending",
    reviewNotes: "TCFTR Seed Pending Request",
    newPasswordRaw: "PendingPass#2026",
    createdAt: daysAgo(2),
  });

  await ensurePasswordRequest({
    user: users.deptChair,
    admin: users.superadmin,
    status: "approved",
    reviewNotes: "TCFTR Seed Approved Request",
    newPasswordRaw: DEFAULT_PASSWORD,
    createdAt: daysAgo(6),
    reviewedAt: daysAgo(5),
  });

  await ensurePasswordRequest({
    user: users.qaAdmin,
    admin: users.superadmin,
    status: "rejected",
    reviewNotes: "TCFTR Seed Rejected Request",
    newPasswordRaw: "RejectedPass#2026",
    createdAt: daysAgo(7),
    reviewedAt: daysAgo(4),
  });

  await ensureNotificationOnce({
    userId: users.user2._id,
    actorId: users.superadmin._id,
    type: "PASSWORD_CHANGE_REQUEST",
    title: "Password change request submitted",
    message: `${users.user2.email} submitted a password change request.`,
    details: "Review the request in Manage Users.",
    relatedId: users.user2._id,
    relatedModel: "User",
    metadata: { requesterEmail: users.user2.email },
  });

  await ensureNotificationOnce({
    userId: users.deptChair._id,
    actorId: users.superadmin._id,
    type: "PASSWORD_CHANGE_APPROVED",
    title: "Password Change Approved",
    message: "Your password change request has been approved",
    details: "You can now log in with your new password",
    relatedId: users.deptChair._id,
    relatedModel: "User",
    metadata: {},
  });

  await ensureNotificationOnce({
    userId: users.qaAdmin._id,
    actorId: users.superadmin._id,
    type: "PASSWORD_CHANGE_REJECTED",
    title: "Password Change Rejected",
    message: "Your password change request has been rejected",
    details: "Please contact your administrator for more information",
    relatedId: users.qaAdmin._id,
    relatedModel: "User",
    metadata: {},
  });
}

async function ensurePasswordRequest(params) {
  const { user, admin, status, reviewNotes, newPasswordRaw, createdAt, reviewedAt } = params;
  let request = await PasswordRequest.findOne({ userId: user._id, reviewNotes });

  if (!request) {
    request = new PasswordRequest({
      userId: user._id,
      currentPassword: "__verified__",
      newPassword: hashPassword(newPasswordRaw),
      status,
      createdAt,
      reviewedAt: reviewedAt || null,
      reviewedBy: admin?._id || null,
      reviewNotes,
    });
  } else {
    request.currentPassword = "__verified__";
    request.newPassword = hashPassword(newPasswordRaw);
    request.status = status;
    request.createdAt = createdAt;
    request.reviewedAt = reviewedAt || null;
    request.reviewedBy = admin?._id || null;
    request.reviewNotes = reviewNotes;
  }

  await request.save();
  if (status === "approved") {
    user.password = hashPassword(DEFAULT_PASSWORD);
    await user.save();
  }
}

async function ensureRecentAndAuditCoverage(users, files, folders) {
  await ensureLogOnce(
    users.user1._id,
    "ACCESS_FILE",
    encodeAccessDetails("VIEW", files.policyPdf),
    daysAgo(1)
  );
  await ensureLogOnce(
    users.user1._id,
    "ACCESS_FILE",
    encodeAccessDetails("DOWNLOAD", files.reportDocx),
    daysAgo(1)
  );
  await ensureLogOnce(
    users.user1._id,
    "ACCESS_FILE",
    encodeAccessDetails("EDITOR_OPEN", files.searchable),
    daysAgo(0)
  );

  await ensureAuditLogOnce({
    userId: users.user1._id,
    action: "view",
    resourceType: "file",
    resourceId: files.policyPdf._id,
    details: { originalName: files.policyPdf.originalName, source: "seed" },
  });
  await ensureAuditLogOnce({
    userId: users.user1._id,
    action: "download",
    resourceType: "file",
    resourceId: files.reportDocx._id,
    details: { originalName: files.reportDocx.originalName, source: "seed" },
  });
  await ensureAuditLogOnce({
    userId: users.superadmin._id,
    action: "share",
    resourceType: "folder",
    resourceId: folders.sharedFolder._id,
    details: { folderName: folders.sharedFolder.name, source: "seed" },
  });
  await ensureAuditLogOnce({
    userId: users.superadmin._id,
    action: "delete",
    resourceType: "file",
    resourceId: files.trashFile._id,
    details: { originalName: files.trashFile.originalName, source: "seed" },
  });
}

function encodeAccessDetails(action, file) {
  const safeName = String(file?.originalName || "").replace(/[|]/g, " ");
  return `FILE_ACCESS|${action}|${toId(file)}|${safeName}`;
}

async function ensureLogOnce(userId, action, details, date) {
  const exists = await Log.findOne({
    user: userId || null,
    action,
    details,
  });
  if (exists) return exists;

  return Log.create({
    user: userId || null,
    action,
    details,
    date: date || now,
    timeStamp: date || now,
  });
}

async function ensureAuditLogOnce(entry) {
  const exists = await AuditLog.findOne({
    userId: entry.userId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId || null,
  });
  if (exists) return exists;

  return AuditLog.create({
    userId: entry.userId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId || null,
    details: entry.details || {},
    ipAddress: "127.0.0.1",
    userAgent: "seed-test-cases-data.js",
  });
}

async function ensureNotificationOnce(entry) {
  const exists = await Notification.findOne({
    userId: entry.userId,
    type: entry.type,
    title: entry.title,
    details: entry.details || "",
  });
  if (exists) return exists;

  return Notification.create({
    userId: entry.userId,
    actorId: entry.actorId || null,
    type: entry.type,
    title: entry.title,
    message: entry.message,
    details: entry.details || "",
    isRead: !!entry.isRead,
    relatedId: entry.relatedId || null,
    relatedModel: entry.relatedModel || null,
    metadata: entry.metadata || {},
    createdAt: entry.createdAt || now,
    date: entry.createdAt || now,
  });
}

async function ensureCopcCoverage(users, folders, files) {
  const mainProgram = await ensureCopcProgram({
    code: PREFIX,
    name: `${PREFIX} COPC Program`,
    year: 2026,
    description: "College of Technology seeded COPC workspace",
    users,
  });

  const mainUploadFolders = await getCopcUploadFolders(mainProgram._id, users.superadmin, "superadmin");
  if (mainUploadFolders.length < 4) {
    throw new Error("COPC main program does not have enough upload-eligible folders for coverage seeding.");
  }

  let mainTasks = null;
  for (const folder of mainUploadFolders.slice(0, 4)) {
    const seeded = await ensureFolderTaskState({
      folderId: folder._id,
      users,
      type: "copc",
    });
    if (!mainTasks) mainTasks = seeded;
  }

  const approvedCopcFile = await ensureCopcSubmission({
    folderId: mainUploadFolders[0]._id,
    token: "Curriculum_Mapping",
    users,
    desiredState: "approved",
    qaCategory: "Curriculum and Instruction",
  });

  const chairRejectedCopcFile = await ensureCopcSubmission({
    folderId: mainUploadFolders[1]._id,
    token: "Faculty_Profile",
    users,
    desiredState: "rejected_program_chair",
  });

  const qaRejectedCopcFile = await ensureCopcSubmission({
    folderId: mainUploadFolders[2]._id,
    token: "Laboratory_Inventory",
    users,
    desiredState: "rejected_qa",
    qaCategory: "Laboratory and Facilities",
  });

  const pendingCopcFile = await ensureCopcSubmission({
    folderId: mainUploadFolders[3]._id,
    token: "Extension_Program",
    users,
    desiredState: "pending_program_chair",
  });

  await ensureCopcObservation(mainProgram._id, users.evaluator);
  await ensureCopcDocumentRequest(mainProgram._id, mainUploadFolders[3]._id, users);

  const rootTasks = await ensureFolderTaskState({
    folderId: folders.rootFolder._id,
    users,
    type: "general",
  });

  const lockedProgram = await ensureCopcProgram({
    code: "TCFLOCK",
    name: `${PREFIX} Locked COPC Program`,
    year: 2025,
    description: "Fully approved and locked seeded COPC workspace",
    users,
  });

  const lockedUploadFolders = await getCopcUploadFolders(lockedProgram._id, users.superadmin, "superadmin");
  let lockedApprovedFile;
  if (lockedUploadFolders.length) {
    await ensureFolderTaskState({
      folderId: lockedUploadFolders[0]._id,
      users,
      type: "copc",
    });

    lockedApprovedFile = await ensureCopcSubmission({
      folderId: lockedUploadFolders[0]._id,
      token: "Program_Objectives",
      users,
      desiredState: "approved",
      qaCategory: "Program Objectives",
    });

    await ensureCopcProgramAction(lockedProgram._id, users.qaAdmin, "compile_package");
    await ensureCopcProgramAction(lockedProgram._id, users.superadmin, "final_approval");
  } else {
    lockedApprovedFile = await File.findOne({
      deletedAt: null,
      userId: toId(users.user1),
      originalName: /Program_Objectives/i,
      "reviewWorkflow.status": "approved",
    }).sort({ uploadDate: -1 });
    if (!lockedApprovedFile) {
      throw new Error("COPC locked program has no reusable approved file for idempotent reruns.");
    }
  }

  return {
    mainProgram: await Folder.findById(mainProgram._id),
    lockedProgram: await Folder.findById(lockedProgram._id),
    mainUploadFolders,
    approvedCopcFile,
    chairRejectedCopcFile,
    qaRejectedCopcFile,
    pendingCopcFile,
    lockedApprovedFile,
    rootTasks,
    mainTasks,
  };
}

async function ensureCopcProgram(params) {
  const { code, name, year, description, users } = params;
  let program = await Folder.findOne({
    "copc.isProgramRoot": true,
    "copc.programCode": code,
    "copc.year": year,
    deletedAt: null,
  });

  if (!program) {
    const response = await apiJson("/copc/programs/init", {
      method: "POST",
      body: {
        userId: toId(users.superadmin),
        role: "superadmin",
        programCode: code,
        programName: name,
        description,
        departmentName: description,
        year,
        uploaderIds: [toId(users.user1)],
        deptChairIds: [toId(users.deptChair)],
        qaAdminIds: [toId(users.qaAdmin)],
        evaluatorIds: [toId(users.evaluator)],
      },
      expectedStatuses: [200, 409],
    });

    if (response?.programFolderId) {
      program = await Folder.findById(response.programFolderId);
    } else {
      program = await Folder.findOne({
        "copc.isProgramRoot": true,
        "copc.programCode": code,
        "copc.year": year,
        deletedAt: null,
      });
    }
  }

  await apiJson(`/copc/programs/${program._id}/assignments`, {
    method: "PATCH",
    body: {
      userId: toId(users.superadmin),
      role: "superadmin",
      assignments: {
        uploaders: [toId(users.user1)],
        programChairs: [toId(users.deptChair)],
        qaOfficers: [toId(users.qaAdmin)],
        evaluators: [toId(users.evaluator)],
      },
    },
    expectedStatuses: [200, 423],
  }).catch((error) => {
    if (error?.status === 423) return null;
    throw error;
  });

  return normalizeCopcProgramProfileKey(program);
}

async function normalizeCopcProgramProfileKey(program) {
  const root = await Folder.findById(program?._id).select("_id complianceProfileKey");
  const profileKey = String(root?.complianceProfileKey || "");
  if (!root?._id || !profileKey) {
    return root;
  }

  const queue = [root._id];
  const folderIds = [root._id];

  while (queue.length) {
    const batch = queue.splice(0, 25);
    const children = await Folder.find({
      parentFolder: { $in: batch },
      deletedAt: null,
    }).select("_id");

    for (const child of children) {
      folderIds.push(child._id);
      queue.push(child._id);
    }
  }

  await Folder.updateMany(
    {
      _id: { $in: folderIds },
      deletedAt: null,
      complianceProfileKey: { $ne: profileKey },
    },
    { $set: { complianceProfileKey: profileKey } }
  );

  return Folder.findById(root._id);
}

async function getCopcUploadFolders(programId, user, role) {
  const response = await apiJson(`/copc/programs/${programId}/folders`, {
    method: "GET",
    query: {
      userId: toId(user),
      role,
    },
    expectedStatuses: [200],
  });

  return (response?.folders || []).filter((entry) => entry.canUpload && !entry.isProgramRoot);
}

async function ensureCopcSubmission(params) {
  const { folderId, token, users, desiredState, qaCategory } = params;

  let file = await File.findOne({
    parentFolder: folderId,
    deletedAt: null,
    originalName: { $regex: token, $options: "i" },
  }).sort({ uploadDate: 1 });

  if (!file) {
    await uploadFile({
      filePath: assetPaths.copcPdf,
      originalName: `${token}.pdf`,
      mimeType: "application/pdf",
      userId: toId(users.user1),
      role: "user",
      parentFolder: String(folderId),
    });
    file = await File.findOne({
      parentFolder: folderId,
      deletedAt: null,
      originalName: { $regex: token, $options: "i" },
    }).sort({ uploadDate: -1 });
  }

  if (desiredState === "pending_program_chair") {
    return File.findById(file._id);
  }

  file = await File.findById(file._id);
  const workflowStatus = String(file?.reviewWorkflow?.status || "");
  const chairStatus = String(file?.reviewWorkflow?.programChair?.status || "");
  const qaStatus = String(file?.reviewWorkflow?.qaOfficer?.status || "");

  if (desiredState === "rejected_program_chair") {
    if (workflowStatus !== "rejected_program_chair") {
      await apiJson(`/files/${file._id}/review/program-chair`, {
        method: "PATCH",
        body: {
          userId: toId(users.deptChair),
          role: "dept_chair",
          action: "reject",
          notes: "Seeded department-chair rejection for revision coverage.",
        },
        expectedStatuses: [200],
      });
    }
    return File.findById(file._id);
  }

  if (chairStatus !== "approved") {
    await apiJson(`/files/${file._id}/review/program-chair`, {
      method: "PATCH",
      body: {
        userId: toId(users.deptChair),
        role: "dept_chair",
        action: "approve",
        notes: "Seeded department-chair approval.",
      },
      expectedStatuses: [200],
    });
  }

  if (qaCategory) {
    const refreshedForTag = await File.findById(file._id);
    if (String(refreshedForTag?.classification?.category || "") !== qaCategory) {
      await apiJson(`/files/${file._id}/review/qa/tag-category`, {
        method: "PATCH",
        body: {
          userId: toId(users.qaAdmin),
          role: "qa_admin",
          category: qaCategory,
          tags: ["seeded", "copc", "qa-reviewed"],
        },
        expectedStatuses: [200],
      });
    }
  }

  const refreshed = await File.findById(file._id);
  const nextQaStatus = String(refreshed?.reviewWorkflow?.qaOfficer?.status || qaStatus);
  const nextWorkflowStatus = String(refreshed?.reviewWorkflow?.status || workflowStatus);
  if (desiredState === "approved" && nextWorkflowStatus !== "approved") {
    await apiJson(`/files/${file._id}/review/qa`, {
      method: "PATCH",
      body: {
        userId: toId(users.qaAdmin),
        role: "qa_admin",
        action: "approve",
        notes: "Seeded QA approval.",
      },
      expectedStatuses: [200],
    });
  } else if (desiredState === "rejected_qa" && nextQaStatus !== "rejected") {
    await apiJson(`/files/${file._id}/review/qa`, {
      method: "PATCH",
      body: {
        userId: toId(users.qaAdmin),
        role: "qa_admin",
        action: "reject",
        notes: "Seeded QA rejection for correction coverage.",
      },
      expectedStatuses: [200],
    });
  }

  return File.findById(file._id);
}

async function ensureCopcObservation(programId, evaluator) {
  const program = await Folder.findById(programId).select("copc.observations");
  const exists = (program?.copc?.observations || []).some((entry) =>
    String(entry?.message || "").includes("Seeded evaluator observation")
  );
  if (exists) return;

  await apiJson(`/copc/programs/${programId}/observations`, {
    method: "POST",
    body: {
      userId: toId(evaluator),
      role: "evaluator",
      message: "Seeded evaluator observation: verify supporting evidence alignment before final packaging.",
    },
    expectedStatuses: [200],
  });
}

async function ensureCopcDocumentRequest(programId, folderId, users) {
  const existing = await Notification.findOne({
    userId: users.user1._id,
    type: "DOCUMENT_REQUEST",
    relatedId: folderId,
    "metadata.documentName": "Missing MOA Appendix",
    isRead: false,
  });
  if (existing) return existing;

  await ensureNotificationOnce({
    userId: users.user1._id,
    actorId: users.qaAdmin._id,
    type: "DOCUMENT_REQUEST",
    title: "Document request",
    message: "Please upload the missing MOA appendix for seeded document-request coverage.",
    details: "Missing MOA Appendix",
    relatedId: folderId,
    relatedModel: "Folder",
    metadata: {
      folderName: "Seeded COPC folder",
      documentName: "Missing MOA Appendix",
      deadline: daysFromNow(4).toISOString(),
    },
  });
}

async function ensureFolderTaskState(params) {
  const { folderId, users, type } = params;
  const assignments = {
    uploaders: [toId(users.user1)],
    programChairs: [toId(users.deptChair)],
    qaOfficers: [toId(users.qaAdmin)],
    evaluators: [toId(users.evaluator)],
  };

  await apiJson(`/folders/${folderId}/assignments`, {
    method: "PATCH",
    body: {
      userId: toId(users.superadmin),
      role: "superadmin",
      assignments,
    },
    expectedStatuses: [200, 423],
  }).catch((error) => {
    if (error?.status === 423) return null;
    throw error;
  });

  const tasks =
    type === "general"
      ? [
          {
            title: "Organize baseline TCFTR evidence set",
            description: "Confirm baseline uploads, favorites, pins, and shared resources are still visible.",
            taskType: "general",
            folderPath: `${PREFIX} Root`,
            assignedRole: "user",
            assignedTo: toId(users.user1),
            assignedUploaders: [toId(users.user1)],
            priority: "high",
            dueDate: daysFromNow(5).toISOString(),
            createdBy: toId(users.superadmin),
            percentage: 45,
            status: "in_progress",
            scope: "My Drive baseline coverage",
            checks: ["Searchable file verified", "Shared folder access checked"],
            comments: [{ message: "Need final review of the shared editable file before closing this task.", createdBy: toId(users.superadmin), createdAt: daysAgo(1).toISOString() }],
            history: [
              { action: "created", fromStatus: "", toStatus: "pending", notes: "Seeded general task coverage.", actor: toId(users.superadmin), at: daysAgo(2).toISOString() },
              { action: "status_updated", fromStatus: "pending", toStatus: "in_progress", notes: "Uploader started verifying the workspace set.", actor: toId(users.user1), at: daysAgo(1).toISOString() },
            ],
          },
          {
            title: "Review collaboration sharing permissions",
            description: "Validate viewer/editor access for user, folder, and group sharing.",
            taskType: "review",
            folderPath: `${PREFIX} Root`,
            assignedRole: "dept_chair",
            assignedTo: toId(users.deptChair),
            assignedProgramChairs: [toId(users.deptChair)],
            priority: "medium",
            dueDate: daysFromNow(3).toISOString(),
            createdBy: toId(users.superadmin),
            percentage: 75,
            status: "for_review",
            scope: "Collaboration permissions",
            checks: ["Viewer share checked", "Editor share checked", "Group share checked"],
            comments: [{ message: "Department chair review is waiting on the final admin sign-off.", createdBy: toId(users.user1), createdAt: daysAgo(1).toISOString() }],
            history: [
              { action: "created", fromStatus: "", toStatus: "pending", notes: "Seeded review task coverage.", actor: toId(users.superadmin), at: daysAgo(2).toISOString() },
              { action: "submitted_for_review", fromStatus: "in_progress", toStatus: "for_review", notes: "Evidence checks were submitted for seeded review coverage.", actor: toId(users.user1), at: daysAgo(0).toISOString() },
            ],
          },
          {
            title: "Validate classification cleanup batch",
            description: "Confirm reclassification coverage and analytics notes are reflected in search results.",
            taskType: "approval",
            folderPath: `${PREFIX} Root`,
            assignedRole: "qa_admin",
            assignedTo: toId(users.qaAdmin),
            assignedQaOfficers: [toId(users.qaAdmin)],
            priority: "medium",
            dueDate: daysFromNow(2).toISOString(),
            createdBy: toId(users.superadmin),
            percentage: 100,
            status: "approved",
            scope: "Search and classification review",
            checks: ["Single reclassify checked", "Bulk reclassify checked"],
            comments: [{ message: "QA confirmed that classification and search coverage look good.", createdBy: toId(users.qaAdmin), createdAt: daysAgo(0).toISOString() }],
            history: [
              { action: "created", fromStatus: "", toStatus: "pending", notes: "Seeded QA approval coverage.", actor: toId(users.superadmin), at: daysAgo(3).toISOString() },
              { action: "approved", fromStatus: "for_review", toStatus: "approved", notes: "Approved by seeded QA workflow.", actor: toId(users.qaAdmin), at: daysAgo(1).toISOString() },
            ],
          },
        ]
      : [
          {
            title: "Upload updated COPC evidence pack",
            description: "Primary uploader task for seeded COPC workflow progress.",
            taskType: "document",
            folderPath: "COPC seeded folder",
            assignedRole: "user",
            assignedTo: toId(users.user1),
            assignedUploaders: [toId(users.user1)],
            priority: "critical",
            dueDate: daysFromNow(4).toISOString(),
            createdBy: toId(users.superadmin),
            percentage: 100,
            status: "approved",
            scope: "COPC uploader responsibility",
            checks: ["Evidence PDF uploaded", "Submission reviewed"],
            comments: [{ message: "Seeded approved task aligned with the approved COPC file.", createdBy: toId(users.qaAdmin), createdAt: daysAgo(1).toISOString() }],
            history: [
              { action: "created", fromStatus: "", toStatus: "pending", notes: "Seeded COPC uploader task.", actor: toId(users.superadmin), at: daysAgo(4).toISOString() },
              { action: "approved", fromStatus: "for_review", toStatus: "approved", notes: "Approved after seeded QA verification.", actor: toId(users.qaAdmin), at: daysAgo(1).toISOString() },
            ],
          },
          {
            title: "Department review follow-up",
            description: "Pending review item for department-chair stage coverage.",
            taskType: "review",
            folderPath: "COPC seeded folder",
            assignedRole: "dept_chair",
            assignedTo: toId(users.deptChair),
            assignedProgramChairs: [toId(users.deptChair)],
            priority: "high",
            dueDate: daysFromNow(2).toISOString(),
            createdBy: toId(users.superadmin),
            percentage: 75,
            status: "for_review",
            scope: "Department review queue",
            checks: ["Rejected file reviewed", "Notes prepared"],
            comments: [{ message: "Waiting for the chair to finish the seeded review notes.", createdBy: toId(users.user1), createdAt: daysAgo(0).toISOString() }],
            history: [{ action: "submitted_for_review", fromStatus: "in_progress", toStatus: "for_review", notes: "Submitted for seeded department review.", actor: toId(users.user1), at: daysAgo(0).toISOString() }],
          },
          {
            title: "QA correction checkpoint",
            description: "Rejected QA checkpoint for revision-request visibility.",
            taskType: "approval",
            folderPath: "COPC seeded folder",
            assignedRole: "qa_admin",
            assignedTo: toId(users.qaAdmin),
            assignedQaOfficers: [toId(users.qaAdmin)],
            priority: "high",
            dueDate: daysFromNow(1).toISOString(),
            createdBy: toId(users.superadmin),
            percentage: 100,
            status: "rejected",
            scope: "QA correction coverage",
            checks: ["QA note captured", "Request sent back to uploader"],
            comments: [{ message: "Seeded QA rejection note: missing appendix references must be revised.", createdBy: toId(users.qaAdmin), createdAt: daysAgo(0).toISOString() }],
            history: [{ action: "rejected", fromStatus: "for_review", toStatus: "rejected", notes: "Seeded QA rejection for correction visibility.", actor: toId(users.qaAdmin), at: daysAgo(0).toISOString() }],
          },
        ];

  const response = await apiJson(`/folders/${folderId}/tasks`, {
    method: "PUT",
    body: {
      userId: toId(users.superadmin),
      role: "superadmin",
      tasks,
      assignments,
    },
    expectedStatuses: [200, 423],
  }).catch((error) => {
    if (error?.status === 423) return { tasks: [], progress: null, statusCounts: {} };
    throw error;
  });

  return response;
}

async function ensureCopcProgramAction(programId, actor, action) {
  const root = await Folder.findById(programId).select("copc");
  if (!root?.copc?.isProgramRoot) return;
  if (action === "compile_package" && root?.copc?.workflowStage === "package_compiled") return;
  if (action === "final_approval" && root?.copc?.locked?.isLocked) return;

  await apiJson(`/copc/programs/${programId}/actions`, {
    method: "POST",
    body: { userId: toId(actor), role: actor.role, action },
    expectedStatuses: [200, 400, 423],
  }).catch((error) => {
    if ([400, 423].includes(error?.status)) return null;
    throw error;
  });
}

async function buildSummary(context) {
  const { users, folders, files, groups, comments, forms, copc } = context;
  const user2Notifications = await Notification.find({ userId: users.user2._id }).sort({ createdAt: -1 });
  const passwordRequests = await PasswordRequest.find({
    userId: { $in: [users.user2._id, users.deptChair._id, users.qaAdmin._id] },
  }).sort({ createdAt: -1 });
  const trash = await apiJson("/trash", {
    method: "GET",
    query: { userId: toId(users.superadmin), role: "superadmin" },
    expectedStatuses: [200],
  }).catch(() => ({ files: [], folders: [] }));
  const seededTrashFiles = (trash.files || []).filter((entry) =>
    /TCFTR|drag-file/i.test(String(entry?.originalName || ""))
  );
  const seededTrashFolders = (trash.folders || []).filter((entry) =>
    /TCFTR/i.test(String(entry?.name || ""))
  );

  const mainTaskFolderId = copc.mainUploadFolders?.[0]?._id || null;

  return {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    credentials: {
      defaultPassword: DEFAULT_PASSWORD,
      emails: {
        superadmin: users.superadmin.email,
        user1: users.user1.email,
        user2: users.user2.email,
        deptChair: users.deptChair.email,
        qaAdmin: users.qaAdmin.email,
        evaluator: users.evaluator.email,
      },
      otpCodes: {
        registrationEmail: REGISTRATION_EMAIL,
        registrationCode: REGISTRATION_CODE,
        passwordResetEmail: users.user1.email,
        passwordResetCode: PASSWORD_RESET_CODE,
      },
    },
    ids: {
      superadminId: toId(users.superadmin),
      user1Id: toId(users.user1),
      user2Id: toId(users.user2),
      deptChairId: toId(users.deptChair),
      qaAdminId: toId(users.qaAdmin),
      evaluatorId: toId(users.evaluator),
      rootFolderId: toId(folders.rootFolder),
      sharedFolderId: toId(folders.sharedFolder),
      moveTargetFolderId: toId(folders.moveTargetFolder),
      searchableFileId: toId(files.searchable),
      docxFileId: toId(files.reportDocx),
      pdfFileId: toId(files.policyPdf),
      groupId: toId(groups.collaborationGroup),
      adminGroupId: toId(groups.adminGroup),
      templateId: toId(forms.template),
      generatedTemplateFileId: toId(forms.generatedFile),
      autoReportFileId: toId(forms.autoReport),
      copcProgramId: toId(copc.mainProgram),
      lockedCopcProgramId: toId(copc.lockedProgram),
      approvedCopcFileId: toId(copc.approvedCopcFile),
      chairRejectedCopcFileId: toId(copc.chairRejectedCopcFile),
      qaRejectedCopcFileId: toId(copc.qaRejectedCopcFile),
      pendingCopcFileId: toId(copc.pendingCopcFile),
      lockedApprovedCopcFileId: toId(copc.lockedApprovedFile),
      rootCommentId: toId(comments.rootComment),
      replyCommentId: toId(comments.reply),
      editedCommentId: toId(comments.editedComment),
      mainTaskFolderId: String(mainTaskFolderId || ""),
    },
    names: {
      rootFolder: folders.rootFolder.name,
      sharedFolder: folders.sharedFolder.name,
      moveTargetFolder: folders.moveTargetFolder.name,
      collaborationGroup: groups.collaborationGroup.name,
      adminGroup: groups.adminGroup.name,
      copcProgramCode: copc.mainProgram?.copc?.programCode || PREFIX,
      copcProgramName: copc.mainProgram?.copc?.programName || `${PREFIX} COPC Program`,
      lockedCopcProgramCode: copc.lockedProgram?.copc?.programCode || "TCFLOCK",
      lockedCopcProgramName: copc.lockedProgram?.copc?.programName || `${PREFIX} Locked COPC Program`,
    },
    coverage: {
      folders: {
        deepArchiveFolderId: toId(folders.deepArchiveFolder),
        semesterFolderId: toId(folders.semesterFolder),
        movedRenamedFolderId: toId(folders.folderMoveCandidate),
        trashedFolderId: toId(folders.trashFolder),
      },
      files: {
        searchable: files.searchable.originalName,
        policyPdf: files.policyPdf.originalName,
        reportDocx: files.reportDocx.originalName,
        imageJpg: files.imageJpg.originalName,
        dragFile: files.dragFile.originalName,
        duplicateNames: [files.duplicate1.originalName, files.duplicate2.originalName],
        sharedEditableId: toId(files.sharedEditable),
        renamedArchiveId: toId(files.renamedArchive),
        movedFileId: toId(files.moveCandidate),
        trashedFileId: toId(files.trashFile),
      },
      notifications: {
        user2Total: user2Notifications.length,
        user2Unread: user2Notifications.filter((entry) => !entry.isRead).length,
        recentTypes: user2Notifications.slice(0, 10).map((entry) => entry.type),
      },
      comments: {
        rootComment: comments.rootComment?.content || "",
        replyComment: comments.reply?.content || "",
        editedComment: comments.editedComment?.content || "",
      },
      passwordRequests: passwordRequests.map((request) => ({
        _id: toId(request),
        userId: toId(request.userId),
        status: request.status,
        reviewNotes: request.reviewNotes || "",
      })),
      trash: {
        files: seededTrashFiles.map((entry) => ({ _id: toId(entry), originalName: entry.originalName })),
        folders: seededTrashFolders.map((entry) => ({ _id: toId(entry), name: entry.name })),
      },
      forms: {
        templateName: forms.template?.name || "",
        generatedFileName: forms.generatedFile?.originalName || "",
        autoReportName: forms.autoReport?.originalName || "",
      },
      copc: {
        mainProgram: {
          _id: toId(copc.mainProgram),
          code: copc.mainProgram?.copc?.programCode || "",
          name: copc.mainProgram?.copc?.programName || "",
          stage: copc.mainProgram?.copc?.workflowStage || "",
          status: copc.mainProgram?.copc?.workflowStatus || "",
        },
        lockedProgram: {
          _id: toId(copc.lockedProgram),
          code: copc.lockedProgram?.copc?.programCode || "",
          name: copc.lockedProgram?.copc?.programName || "",
          stage: copc.lockedProgram?.copc?.workflowStage || "",
          status: copc.lockedProgram?.copc?.workflowStatus || "",
          locked: !!copc.lockedProgram?.copc?.locked?.isLocked,
        },
        uploadFolderIds: (copc.mainUploadFolders || []).slice(0, 4).map((entry) => entry._id),
        submissions: {
          approved: { _id: toId(copc.approvedCopcFile), name: copc.approvedCopcFile?.originalName || "", status: copc.approvedCopcFile?.reviewWorkflow?.status || "" },
          chairRejected: { _id: toId(copc.chairRejectedCopcFile), name: copc.chairRejectedCopcFile?.originalName || "", status: copc.chairRejectedCopcFile?.reviewWorkflow?.status || "" },
          qaRejected: { _id: toId(copc.qaRejectedCopcFile), name: copc.qaRejectedCopcFile?.originalName || "", status: copc.qaRejectedCopcFile?.reviewWorkflow?.status || "" },
          pending: { _id: toId(copc.pendingCopcFile), name: copc.pendingCopcFile?.originalName || "", status: copc.pendingCopcFile?.reviewWorkflow?.status || "" },
        },
        tasks: {
          rootTaskProgress: copc.rootTasks?.progress || 0,
          copcTaskProgress: copc.mainTasks?.progress || 0,
        },
      },
      seedNotes: {
        helpFeedback: "The Help & Feedback page in this build is client-side only, so it does not require a database seed record.",
        negativeCases: "Validation and unauthorized-access test cases are supported by the seeded roles, ownership, and pending requests above rather than separate negative-only records.",
      },
    },
  };
}

main().catch((error) => {
  console.error("Seed failed:", error?.stack || error?.message || error);
  process.exitCode = 1;
});
