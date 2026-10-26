const mongoose = require("mongoose");

const selectedSlotSchema = new mongoose.Schema(
  {
    date: String,
    startTime: String,
    endTime: String,
    status: String,
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
