const path = require("path");
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
      return {
        ...file.toObject(),
        isShared: !isOwner,
        permission: isOwner ? "owner" : (file.permissions || "read"),
        ownerEmail: file.owner?.email || null
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
      permissions: f.permissions || "owner"
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
      userGroups = await Group.find({ members: userId }).select('_id name sharedFiles sharedFolders');
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
                  sharedAt: sharedFile.sharedAt
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
                  sharedAt: sharedFolder.sharedAt
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
      permissions: f.permission || "read"
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

// Restore file (Admin only)
app.patch("/trash/files/:id/restore", async (req, res) => {
  try {
    const { role } = req.query;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Only admins can restore files" });
    }

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

// Restore folder (Admin only)
app.patch("/trash/folders/:id/restore", async (req, res) => {
  try {
    const { role } = req.query;
    if (role !== "admin" && role !== "superadmin") {
      return res.status(403).json({ error: "Only admins can restore folders" });
    }

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
      // Add to leaders if not already
      if (!group.leaders.some(id => id.toString() === userId)) {
        group.leaders.push(userId);
      }
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
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  createLog("SYSTEM", null, `Server started on ${HOST}:${PORT}`);
});
