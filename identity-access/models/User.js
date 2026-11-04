const mongoose = require("mongoose");

const { ALL_ROLES } = require("../constants/roles");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },
    roles: {
      type: [String],
      required: true,
      enum: ALL_ROLES,
      validate: {
        validator: (roles) => Array.isArray(roles) && roles.length > 0,
        message: "A user account must hold at least one role.",
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    termsAccepted: {
      type: Boolean,
      required: true,
    },
    termsAcceptedAt: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    walletProvisioningStatus: {
      type: String,
      enum: ["pending", "complete", "failed"],
      // Existing monolith users already completed the old in-process wallet
      // workflow. New registrations explicitly set this to "pending" before
      // calling Payments, so the legacy-safe default must be "complete".
      default: "complete",
    },
    walletProvisioningError: {
      type: String,
      default: null,
      maxlength: 500,
    },
    walletProvisioningUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.index({ isDeleted: 1, createdAt: -1 });

userSchema.pre(/^find/, function () {
  const options = this.getOptions?.() || {};
  const filter = this.getFilter?.() || {};

  if (options.ignoreIsDeleted || filter.isDeleted === true) return;
  this.where({ isDeleted: { $ne: true } });
});

module.exports = mongoose.model("User", userSchema, "users");
