const mongoose = require("mongoose");

const slotLockSchema = new mongoose.Schema(
  {
    mentorId: mongoose.Schema.Types.ObjectId,
    lockedBy: mongoose.Schema.Types.ObjectId,
    date: String,
    startTime: String,
    endTime: String,
    expiresAt: Date,
  },
  { strict: false, timestamps: true },
);

module.exports = mongoose.model("SlotLock", slotLockSchema);
