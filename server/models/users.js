const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "user" }, //  "user" or "admin"
  active: { type: Boolean, default: true }, // user account status
  profilePicture: { type: String, default: null } // profile picture filename
});

const UserModel = mongoose.model("users", UserSchema);
module.exports = UserModel;
