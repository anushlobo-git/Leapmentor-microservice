const mongoose = require("mongoose");

const selectedSlotSchema = new mongoose.Schema(
  {
    date: String,
    startTime: String,
    endTime: String,
    status: String,
    meetingLink: String,
    menteeMarked: { type: Boolean, default: false },
    mentorMarked: { type: Boolean, default: false },
    completedAt: Date,
  },
  { _id: false, strict: false },
);

const connectRequestSchema = new mongoose.Schema(
  {
    mentor: mongoose.Schema.Types.ObjectId,
    status: String,
    selectedSlots: [selectedSlotSchema],
    selectedSlot: selectedSlotSchema,
  },
  { strict: false, timestamps: true },
);

module.exports = mongoose.model("ConnectRequest", connectRequestSchema);
