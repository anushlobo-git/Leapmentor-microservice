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
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },
    lastError: { type: String, default: "" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "emaildeliveries" },
);

module.exports = mongoose.model("EmailDelivery", emailDeliverySchema);
