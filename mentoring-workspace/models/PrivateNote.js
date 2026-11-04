// services/mentoring-workspace/models/PrivateNote.js
const mongoose = require("mongoose");

const privateNoteSchema = new mongoose.Schema(
  {
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      required: [true, "connectRequest session reference is required"],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "author user reference is required"],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, "Private note title cannot exceed 200 characters"],
      default: "Untitled Note",
    },
    content: {
      type: String,
      trim: true,
      maxlength: [20000, "Private note content cannot exceed 20000 characters"],
      default: "",
    },
  },
  { timestamps: true },
);

// All of a user's notes inside one session, newest first.
privateNoteSchema.index({ connectRequest: 1, author: 1, createdAt: -1 });

module.exports =
  mongoose.models.PrivateNote ||
  mongoose.model("PrivateNote", privateNoteSchema);
