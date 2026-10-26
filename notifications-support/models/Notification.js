const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    sourceEventId: { type: String, trim: true, maxlength: 200 },
    type: {
      type: String,
      required: true,
      enum: [
        "connect_request_received",
        "connect_request_accepted",
        "connect_request_declined",
        "upcoming_session",
        "new_message",
        "session_completed",
        "new_review",
        "support_resolved",
      ],
      trim: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ sourceEventId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Notification", notificationSchema);
