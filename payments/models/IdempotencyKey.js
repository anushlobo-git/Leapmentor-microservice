const mongoose = require("mongoose");

const idempotencyKeySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    operation: {
      type: String,
      required: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "succeeded"],
      default: "pending",
    },
    responseBody: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

idempotencyKeySchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 7 },
);

module.exports = mongoose.model(
  "PaymentIdempotencyKey",
  idempotencyKeySchema,
  "payment_idempotency_keys",
);
