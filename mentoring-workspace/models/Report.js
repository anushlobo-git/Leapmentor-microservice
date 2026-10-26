const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    connectRequest: { type: mongoose.Schema.Types.ObjectId, required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, required: true },
    reporterRole: { type: String, enum: ["mentor", "mentee"], required: true },
    complaintType: {
      type: String,
      enum: [
        "inappropriate_behavior",
        "session_misconduct",
        "fake_credentials",
        "spam_scam",
        "refund",
        "other",
      ],
      required: true,
    },
    description: { type: String, required: true, maxlength: 1000, trim: true },
    screenshotUrl: { type: String, default: "", trim: true },
    screenshotPublicId: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["open", "under_review", "resolved", "dismissed"],
      default: "open",
    },
    adminNote: { type: String, default: "", maxlength: 2000, trim: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
    refundProcessed: { type: Boolean, default: false },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ connectRequest: 1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ reportedUser: 1 });

module.exports = mongoose.model("WorkspaceReport", reportSchema, "reports");
