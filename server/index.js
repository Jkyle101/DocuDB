const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const UserModel = require("./models/users");
const File = require("./models/file"); // ⬅️ use the model above

const app = express();
app.use(cors());
app.use(express.json());

// static for direct file serving (download links)
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

/** LOGIN — return userId so the FE can store it */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });

    if (!user) return res.status(404).json({ error: "No record found" });
    if (user.password !== password) return res.status(401).json({ error: "The password is incorrect" });

    // Return id + role
    res.json({ status: "success", role: user.role, userId: user._id.toString() });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/** UPLOAD — must receive userId and save it */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId in upload" });

    const file = new File({
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      userId, // ⬅️ saved to DB
    });

    await file.save();
    res.json({ success: true, file });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/** LIST — admin sees all, others see only their own */
app.get("/files", async (req, res) => {
  try {
    const { userId, role } = req.query;

    let query = {};
    // accept both "admin" and "superadmin" as admin types
    const isAdmin = role === "admin" || role === "superadmin";

    if (!isAdmin) {
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      query.userId = userId;
    }

    const files = await File.find(query).sort({ uploadDate: -1 });
    res.json(files);
  } catch (err) {
    console.error("Files error:", err);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

/** VIEW — stream inline with the correct Content-Type (per file) */
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

/** DOWNLOAD — force download */
app.get("/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.filename);
  res.download(filePath);
});


const Folder = require("./models/folder");

app.post("/folders", async (req, res) => {
  try {
    const { name, parentFolder, userId } = req.body;

    const newFolder = new Folder({
      name,
      owner: userId,
      parentFolder: parentFolder || null,
    });

    await newFolder.save();
    res.json({ status: "success", folder: newFolder });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
  const File = require("./models/file");

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
app.patch("/folders/:id/share", async (req, res) => {
  try {
    const { userIds, permission } = req.body; // userIds = [user1, user2]
    const folder = await Folder.findById(req.params.id);

    folder.sharedWith.push(...userIds);
    folder.permissions = permission || "read";

    await folder.save();
    res.json({ status: "success", folder });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});


});


app.listen(3001, () => console.log("Server running on port 3001"));
