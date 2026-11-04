const mongoose = require("mongoose");

const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    numberValue: { type: Number, required: true, min: 0, max: 100 },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "PaymentPlatformSetting",
  platformSettingSchema,
  "platform_settings",
);
