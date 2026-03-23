const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, default: "" },
  department: { type: String, default: "Unassigned" },
  role: {
    type: String,
    enum: ["superadmin", "qa_admin", "dept_chair", "faculty", "evaluator"],
    default: "faculty",
  },
  active: { type: Boolean, default: true }, // user account status
  profilePicture: { type: String, default: null }, // profile picture filename
  createdAt: { type: Date, default: Date.now },
});

const UserModel = mongoose.model("users", UserSchema);
module.exports = UserModel;
