const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const UserModel = require("./models/users");
const File = require("./models/file");
const Folder = require("./models/folder");

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

// Connect to MongoDB
mongoose
  .connect("mongodb://127.0.0.1:27017/docudb")
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

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

    const { userId, parentFolder } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const file = new File({
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
    res.json({ success: true, file });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// List files
app.get("/files", async (req, res) => {
  try {
    const { userId, role, parentFolder } = req.query;
    let query = { deletedAt: null }; // exclude trashed files
    const isAdmin = role === "admin" || role === "superadmin";

    if (!isAdmin) {
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      query.userId = userId;
    }
    if (parentFolder) query.parentFolder = parentFolder;
    else query.parentFolder = null;

    const files = await File.find(query)
      .populate("owner", "email")
      .sort({ uploadDate: -1 });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// View file inline
app.get("/view/:filename", async (req, res) => {
  try {
    const doc = await File.findOne({ filename: req.params.filename });
    if (!doc) return res.status(404).send("File not found");

    const filePath = path.join(__dirname, "uploads", req.params.filename);
    res.setHeader("Content-Type", doc.mimetype);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${doc.originalName}"`
    );
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Download file
app.get("/download/:filename", async (req, res) => {
  try {
    const doc = await File.findOne({ filename: req.params.filename });
    if (!doc) return res.status(404).send("File not found");

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
    res.json({ status: "moved-to-trash", file });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Move file
app.patch("/files/:id/move", async (req, res) => {
  try {
    const { newFolderId } = req.body;
    const file = await File.findByIdAndUpdate(
      req.params.id,
      { parentFolder: newFolderId },
      { new: true }
    );
    res.json({ status: "success", file });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
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
    res.json({ success: true, folder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get folders
app.get("/folders", async (req, res) => {
  try {
    const { userId, role, parentFolder } = req.query;
    let query = { deletedAt: null };

    if (parentFolder) query.parentFolder = parentFolder;
    else query.parentFolder = null;

    if (role === "admin" || role === "superadmin") {
      const folders = await Folder.find(query).populate("owner", "email");
      return res.json(folders);
    }

    if (!userId) return res.status(400).json({ error: "Missing userId" });
    query.owner = userId;

    const folders = await Folder.find(query).populate("owner", "email");
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
    const folders = await Folder.find(query);
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json({ status: "moved-to-trash", folder });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
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
    const { userId, folderId } = req.query;
    let folders, files;

    if (folderId) {
      const currentFolder = await Folder.findOne({ _id: folderId });
      if (!currentFolder) return res.status(404).json({ error: "Folder not found" });

      if (
        !currentFolder.sharedWith.includes(userId) &&
        currentFolder.owner.toString() !== userId
      ) {
        return res.status(403).json({ error: "No access to this folder" });
      }

      folders = await Folder.find({ parentFolder: folderId, deletedAt: null }).lean();
      files = await File.find({ parentFolder: folderId, deletedAt: null }).lean();
    } else {
      folders = await Folder.find({ sharedWith: userId, deletedAt: null }).lean();
      files = await File.find({ sharedWith: userId, parentFolder: null, deletedAt: null }).lean();
    }

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
    const { userId, query, type, date } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    let searchQuery = { userId, deletedAt: null };

    if (query) searchQuery.originalName = { $regex: query, $options: "i" };
    if (type) searchQuery.mimetype = { $regex: type, $options: "i" };
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      searchQuery.uploadDate = { $gte: start, $lte: end };
    }

    const results = await File.find(searchQuery).sort({ uploadDate: -1 });
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
    res.json({ status: "permanently-deleted", folder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ========================
   START SERVER
======================== */
app.listen(3001, "0.0.0.0", () =>
  console.log("🚀 Server running on port 3001")
);
