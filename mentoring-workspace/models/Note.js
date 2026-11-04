// services/mentoring-workspace/models/Note.js
const mongoose = require("mongoose");

const FILE_TYPES = ["pdf", "image", "doc", "ppt", "excel", "txt", "other"];

const noteSchema = new mongoose.Schema(
  {
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      required: [true, "connectRequest session reference is required"],
    },
    // Identity owns users; Workspace stores only the ID, so there is no `ref`
    // and the uploader's name is resolved through the Identity client.
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "uploadedBy user reference is required"],
    },
    uploaderRole: {
      type: String,
      required: [true, "uploaderRole is required"],
      enum: {
        values: ["mentor", "mentee"],
        message: "uploaderRole must be either mentor or mentee",
      },
    },
    title: {
      type: String,
      trim: true,
      default: "",
      maxlength: [200, "Note title cannot exceed 200 characters"],
    },
    fileUrl: {
      type: String,
      required: [true, "fileUrl is required"],
    },
    publicId: {
      type: String,
      required: [true, "publicId (storage provider asset key) is required"],
    },
    fileType: {
      type: String,
      enum: {
        values: FILE_TYPES,
        message: "fileType must be one of: " + FILE_TYPES.join(", "),
      },
      default: "other",
    },
    fileName: {
      type: String,
      trim: true,
      default: "",
    },
    // Bytes.
    fileSize: {
      type: Number,
      default: 0,
    },
    // true  = visible only to `uploadedBy`
    // false = shared with both the mentor and the mentee
    isPrivate: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  { timestamps: true },
);

// Chronological shared-file feed for one session.
noteSchema.index({ connectRequest: 1, createdAt: -1 });

// Per-user lookups and cleanup.
noteSchema.index({ uploadedBy: 1 });

// Separates one user's private files from the shared folder of a session.
noteSchema.index({ connectRequest: 1, uploadedBy: 1, isPrivate: 1 });

module.exports = mongoose.models.Note || mongoose.model("Note", noteSchema);
