const mongoose = require("mongoose");

const supportMessageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, default: null },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    role: { type: String, enum: ["mentor", "mentee", "user"], default: "user", trim: true },
    status: { type: String, enum: ["open", "resolved"], default: "open", trim: true },
  },
  { timestamps: true },
);

supportMessageSchema.index({ status: 1, createdAt: -1 });
supportMessageSchema.index({ email: 1 });

module.exports = mongoose.model("SupportMessage", supportMessageSchema);
