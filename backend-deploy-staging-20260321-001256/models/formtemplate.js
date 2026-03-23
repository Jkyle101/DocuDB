const mongoose = require("mongoose");

const FormFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ["text", "textarea", "number", "date", "email"],
      default: "text",
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
  },
  { _id: false }
);

const FormTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
  fields: [FormFieldSchema],
  templateBody: { type: String, required: true }, // Uses {{fieldKey}} placeholders
  outputType: { type: String, enum: ["txt", "docx", "pdf"], default: "docx" },
  destinationFolder: { type: mongoose.Schema.Types.ObjectId, ref: "Folder", default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FormTemplate", FormTemplateSchema);

