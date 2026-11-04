// services/mentoring-workspace/models/Feedback.js
const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      required: true,
    },
    // Identity owns users; Workspace stores only the IDs (no `ref`), and names
    // are resolved through the Identity client.
    from: { type: mongoose.Schema.Types.ObjectId, required: true },
    to: { type: mongoose.Schema.Types.ObjectId, required: true },
    fromRole: {
      type: String,
      enum: ["mentor", "mentee"],
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      required: true,
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be greater than 5"],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
      default: "",
    },
    slotIndex: { type: Number, default: null },
  },
  { timestamps: true },
);

// One feedback per user per session, or per slot when a slotIndex is given.
feedbackSchema.index(
  { connectRequest: 1, from: 1, slotIndex: 1 },
  { unique: true },
);

// All feedback on one session.
feedbackSchema.index({ connectRequest: 1 });

// All feedback received by a user (average rating).
feedbackSchema.index({ to: 1 });

module.exports =
  mongoose.models.Feedback || mongoose.model("Feedback", feedbackSchema);
