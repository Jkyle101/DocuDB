const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, default: "" },
  department: { type: String, default: "Unassigned" },
  role: {
    type: String,
    // Keep legacy "faculty" for backward compatibility with existing records.
    enum: ["superadmin", "qa_admin", "dept_chair", "user", "faculty", "evaluator"],
    default: "user",
  },
  active: { type: Boolean, default: true }, // user account status
  profilePicture: { type: String, default: null }, // profile picture filename
  createdAt: { type: Date, default: Date.now },
});

const UserModel = mongoose.model("users", UserSchema);
module.exports = UserModel;
