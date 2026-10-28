// services/mentoring-workspace/models/Goal.js
const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema(
  {
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      required: [true, "connectRequest field is required"],
      unique: true, // one goal per session
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "mentor reference is required"],
    },
    mentee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "mentee reference is required"],
    },
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      default: "",
    },
    startDate: {
      type: String,
      trim: true,
      maxlength: 10,
      match: [/^\d{4}-\d{2}-\d{2}$/, "startDate must be in YYYY-MM-DD format"],
      default: null,
    },
    endDate: {
      type: String,
      trim: true,
      maxlength: 10,
      match: [/^\d{4}-\d{2}-\d{2}$/, "endDate must be in YYYY-MM-DD format"],
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ["active", "completed", "abandoned"],
        message: "{VALUE} is not a valid status option",
      },
      default: "active",
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "createdBy reference identification is required"],
    },
  },
  {
    timestamps: true,
  },
);

goalSchema.index({ mentor: 1 });
goalSchema.index({ mentee: 1 });

module.exports = mongoose.model("Goal", goalSchema);
