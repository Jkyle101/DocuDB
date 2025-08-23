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

// static for direct file serving
app.use("/uploads", express.static("uploads"));

// connect to Mongo
mongoose.connect("mongodb://127.0.0.1:27017/docudb")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

/** LOGIN */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });

    if (!user) return res.status(404).json({ error: "No record found" });
    if (user.password !== password) return res.status(401).json({ error: "The password is incorrect" });

    res.json({ status: "success", role: user.role, userId: user._id.toString() });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/** UPLOAD FILE */
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
      userId, // string for now
      owner: userId, // make sure this matches a valid User _id
      parentFolder: parentFolder || null,
    });
    

    await file.save();
    res.json({ success: true, file });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

/** LIST FILES */
app.get("/files", async (req, res) => {
  try {
    const { userId, role, parentFolder } = req.query;
    let query = {};

    const isAdmin = role === "admin" || role === "superadmin";

    if (!isAdmin) {
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      query.userId = userId;
    }

    // important: only show files inside the current folder
    if (parentFolder) {
      query.parentFolder = parentFolder;
    } else {
      query.parentFolder = null; // show only root files when no folder selected
    }

    const files = await File.find(query).sort({ uploadDate: -1 });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

/** VIEW FILE INLINE */
app.get("/view/:filename", async (req, res) => {
  try {
    const doc = await File.findOne({ filename: req.params.filename });
    if (!doc) return res.status(404).send("File not found");

    const filePath = path.join(__dirname, "uploads", req.params.filename);
    res.setHeader("Content-Type", doc.mimetype);
    res.setHeader("Content-Disposition", `inline; filename="${doc.originalName}"`);
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).send("Server error");
  }
});

/** DOWNLOAD FILE */
app.get("/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  res.download(filePath);
});

/** CREATE FOLDER */
app.post("/folders", async (req, res) => {
  try {
    const { name, owner, parentFolder } = req.body;
    if (!name || !owner) return res.status(400).json({ error: "Missing folder name or owner" });

    const folder = new Folder({
      name,
      owner,
      parentFolder: parentFolder || null,
      sharedWith: [],
      permissions: "owner"
    });

    await folder.save();
    res.json({ success: true, folder });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET FOLDERS */
app.get("/folders", async (req, res) => {
  try {
    const { userId, role, parentFolder } = req.query;

    let query = { parentFolder: parentFolder || null };

    if (role !== "admin" && role !== "superadmin") {
      query.owner = userId;
    }

    const folders = await Folder.find(query);
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE FOLDER */
app.delete("/folders/:id", async (req, res) => {
  try {
    await Folder.findByIdAndDelete(req.params.id);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

/** DELETE FILE */
app.delete("/files/:id", async (req, res) => {
  try {
    await File.findByIdAndDelete(req.params.id);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

/** MOVE FILE TO FOLDER */
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

/** SHARE FOLDER */
app.patch("/folders/:id/share", async (req, res) => {
  try {
    const { userIds, permission } = req.body;
    const folder = await Folder.findById(req.params.id);

    folder.sharedWith.push(...userIds);
    folder.permissions = permission || "read";

    await folder.save();
    res.json({ status: "success", folder });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

/** BREADCRUMBS (for navigation path) */
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
/** GET ALL FOLDERS (for move modal) */
app.get("/folders/all", async (req, res) => {
  try {
    const { userId, role } = req.query;
    let query = {};

    if (role !== "admin" && role !== "superadmin") {
      query.owner = userId;
    }

    const folders = await Folder.find(query);
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
  

app.listen(3001, () => console.log("Server running on port 3001"));
