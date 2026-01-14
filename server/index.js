require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const UserModel = require("./models/users");
const File = require("./models/file");
const Folder = require("./models/folder");
const Group = require("./models/group");
const FileVersion = require("./models/fileversion");
const FolderVersion = require("./models/folderversion");
const Comment = require("./models/comment");

// NEW: logs model
const Log = require("./models/logs");
const { timeStamp } = require("console");

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
// Upload file
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { userId, parentFolder, isUpdate, fileId, changeDescription } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    let file;
    let versionNumber = 1;

    if (isUpdate && fileId) {
      // Update existing file - create new version
      file = await File.findById(fileId);
      if (!file) return res.status(404).json({ error: "File not found" });

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
    });
    await file.save();
    }

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

    res.json({ success: true, file, version: fileVersion });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// List files
app.get("/files", async (req, res) => {
  try {
    const { userId, role, parentFolder, sortBy, sortOrder } = req.query;
    let query = { deletedAt: null }; // exclude trashed files
    const isAdmin = role === "admin" || role === "superadmin";

    if (!isAdmin) {
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      query.userId = userId;
    }
    // Only filter by parentFolder if it's explicitly provided
    // If not provided (undefined), show all files regardless of folder (for recent view)
    if (parentFolder !== undefined) {
      query.parentFolder = parentFolder === "" ? null : parentFolder;
    }

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

    const files = await File.find(query)
      .populate("owner", "email")
      .sort(sortOptions);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// View file inline
app.get("/view/:filename", async (req, res) => {
  try {
    const { userId } = req.query;
    const doc = await File.findOne({ filename: req.params.filename }).populate("owner");
    if (!doc) return res.status(404).send("File not found");

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

    const filePath = path.join(__dirname, "uploads", req.params.filename);

    // Set appropriate headers for browser preview
    res.setHeader("Content-Type", doc.mimetype);
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

// Download file
app.get("/download/:filename", async (req, res) => {
  try {
    const { userId } = req.query;
    const doc = await File.findOne({ filename: req.params.filename });
    if (!doc) return res.status(404).send("File not found");

    // Check if user owns the file
    const isOwner = doc.owner.toString() === userId || doc.userId === userId;

    // Check if file is shared with user and has write permission
    const isSharedWithWrite = userId &&
      doc.sharedWith.some(id => id.toString() === userId) &&
      doc.permissions === "write";

    // Allow download if user is owner OR has write permission
    if (!isOwner && !isSharedWithWrite) {
      return res.status(403).send("You don't have permission to download this file");
    }

    const filePath = path.join(__dirname, "uploads", req.params.filename);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${doc.originalName}"`
    );
    res.setHeader("Content-Type", doc.mimetype);

    res.download(filePath, doc.originalName);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Soft delete file → moves to Trash
app.delete("/files/:id", async (req, res) => {
  try {
    const file = await File.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date() },
      { new: true }
    );
    if (!file) return res.status(404).json({ error: "File not found" });

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
    query.owner = userId;

    const folders = await Folder.find(query)
      .populate("owner", "email")
      .sort(sortOptions);
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all folders (for move modal)
app.get("/folders/all", async (req, res) => {
  try {
    const { userId, role } = req.query;
    let query = { deletedAt: null };
    if (role !== "admin" && role !== "superadmin") query.owner = userId;
    const folders = await Folder.find(query).sort({ createdAt: -1 });
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

      if (
        !currentFolder.sharedWith.includes(userId) &&
        currentFolder.owner._id.toString() !== userId
      ) {
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
      permissions: f.permissions || "owner"
    }));

    res.json({ folders, files });
  } catch (err) {
    console.error("Shared fetch error:", err);
    res.status(500).json({ error: err.message });
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

    let searchQuery = { userId, deletedAt: null };

    // Search files by name
    const filesByName = await File.find({
      ...searchQuery,
      originalName: { $regex: searchTerm, $options: "i" },
    }).populate("owner", "email");

    if (type) searchQuery.mimetype = { $regex: type, $options: "i" };
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      searchQuery.uploadDate = { $gte: start, $lte: end };
    }

    // Search inside file contents for text-based files
    const allFiles = await File.find(searchQuery).populate("owner", "email");
    const filesWithContent = [];
    const searchLower = searchTerm.toLowerCase();

    for (const file of allFiles) {
      // Skip files already found by name
      if (filesByName.some(f => f._id.toString() === file._id.toString())) {
        continue;
      }

      // Only search inside text-based files
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
      }
    }

    // Combine files found by name and content
    const allFilesResult = [...filesByName, ...filesWithContent];

    // Remove duplicates
    const uniqueFiles = [];
    const seenIds = new Set();
    for (const file of allFilesResult) {
      if (!seenIds.has(file._id.toString())) {
        seenIds.add(file._id.toString());
        uniqueFiles.push(file);
      }
    }

    const results = uniqueFiles.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Failed to search files" });
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
    const file = await File.findByIdAndUpdate(
      req.params.id,
      { deletedAt: null },
      { new: true }
    );
    if (!file) return res.status(404).json({ error: "File not found" });

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
    const folder = await Folder.findByIdAndUpdate(
      req.params.id,
      { deletedAt: null },
      { new: true }
    );
    if (!folder) return res.status(404).json({ error: "Folder not found" });

    // NEW: log restore folder
    createLog("RESTORE_FOLDER", folder.owner, `Restored folder ${folder.name}`);

    res.json({ status: "restored", folder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete file
app.delete("/trash/files/:id", async (req, res) => {
  try {
    const file = await File.findByIdAndDelete(req.params.id);
    if (!file) return res.status(404).json({ error: "File not found" });

    // NEW: log permanent delete
    createLog("PERMANENT_DELETE_FILE", file.owner, `Permanently deleted ${file.originalName}`);

    res.json({ status: "permanently-deleted", file });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Permanently delete folder
app.delete("/trash/folders/:id", async (req, res) => {
  try {
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
      .sort({ createdAt: -1 });
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
    res.json(group);
  } catch (err) {
    console.error("Group fetch error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ========================
   START SERVER
======================== */
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  createLog("SYSTEM", null, `Server started on ${HOST}:${PORT}`);
});
