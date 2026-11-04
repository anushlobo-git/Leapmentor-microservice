const mongoose = require("mongoose");

const oauthAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ["google", "linkedin", "apple"],
      trim: true,
    },
    providerId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

oauthAccountSchema.index({ provider: 1, providerId: 1 }, { unique: true });
oauthAccountSchema.index({ user: 1 });

module.exports = mongoose.model("OAuthAccount", oauthAccountSchema);
