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

const additionalSlotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?\d|2[0-3]):[0-5]\d$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?\d|2[0-3]):[0-5]\d$/,
    },
    meetingLink: { type: String, default: "" },
    menteeMarked: { type: Boolean, default: false },
    mentorMarked: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    paidAt: { type: Date, default: null },
    sessionRate: { type: Number, default: null, min: 0 },
    totalAmount: { type: Number, default: null, min: 0 },
  },
  { _id: true, strict: false },
);

const connectRequestSchema = new mongoose.Schema(
  {
    mentor: mongoose.Schema.Types.ObjectId,
    status: String,
    selectedSlots: [selectedSlotSchema],
    selectedSlot: selectedSlotSchema,
    additionalSlots: { type: [additionalSlotSchema], default: [] },
  },
  { strict: false, timestamps: true },
);

module.exports = mongoose.model("ConnectRequest", connectRequestSchema);
