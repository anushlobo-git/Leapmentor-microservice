const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    role: {
      type: String,
      enum: ["mentor", "mentee"],
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    escrow: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

walletSchema.index({ user: 1, role: 1 }, { unique: true });
walletSchema.index({ user: 1 });

module.exports = mongoose.model("PaymentWallet", walletSchema, "wallets");
