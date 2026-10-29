const mongoose = require("mongoose");

const emailDeliverySchema = new mongoose.Schema(
  {
    sourceEventId: {
      type: String,
      required: true,
      unique: true,
      maxlength: 200,
    },
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: null },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedUntil: { type: Date, default: null },
    lastError: { type: String, default: "" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "emaildeliveries" },
);

emailDeliverySchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model("EmailDelivery", emailDeliverySchema);
