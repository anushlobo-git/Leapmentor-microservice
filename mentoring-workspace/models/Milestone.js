// services/mentoring-workspace/models/Milestone.js
const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
  {
    goal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Goal",
      required: [true, "goal reference identification is required"],
    },
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      required: [true, "connectRequest session reference identification is required"],
      // denormalized for easy querying without joining Goal
    },
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
      maxlength: [300, "Title cannot exceed 300 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    dueDate: {
      type: String, // "YYYY-MM-DD"
      trim: true,
      maxlength: 10,
      match: [/^\d{4}-\d{2}-\d{2}$/, "dueDate must be in YYYY-MM-DD format"],
      default: null,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    // null = goal-level milestone (general, not tied to a session)
    // 0,1,2 = belongs to selectedSlots[0], selectedSlots[1], ...
    slotIndex: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

milestoneSchema.index({ goal: 1, order: 1 });
milestoneSchema.index({ connectRequest: 1 });
milestoneSchema.index({ goal: 1, slotIndex: 1, order: 1 });

module.exports = mongoose.model("Milestone", milestoneSchema);
