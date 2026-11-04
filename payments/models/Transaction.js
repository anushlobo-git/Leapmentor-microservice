const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "credit",
        "debit",
        "escrow_hold",
        "escrow_release",
        "escrow_refund",
        "commission_deduct",
        "mentor_payout",
        "withdrawal",
      ],
      required: true,
    },
    amount: {
      type: Number,
      min: 0.01,
      required: true,
    },
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    idempotencyKey: {
      type: String,
      default: undefined,
    },
    releaseResult: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true },
);

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ connectRequest: 1 });
transactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model(
  "PaymentTransaction",
  transactionSchema,
  "transactions",
);
