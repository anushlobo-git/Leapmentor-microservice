const mongoose = require("mongoose");

const timeSlotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5,
      match: [/^([0-1]?\d|2[0-3]):[0-5]\d$/, "startTime must be HH:MM"],
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5,
      match: [/^([0-1]?\d|2[0-3]):[0-5]\d$/, "endTime must be HH:MM"],
    },
  },
  { _id: false },
);

const dayScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      required: true,
    },
    isAvailable: { type: Boolean, default: false },
    slots: { type: [timeSlotSchema], default: [] },
  },
  { _id: false },
);

const specificDateSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10,
      match: [/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"],
    },
    slots: { type: [timeSlotSchema], default: [] },
  },
  { _id: false },
);

const availabilitySchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    timezone: { type: String, trim: true, maxlength: 100, default: "Asia/Kolkata" },
    sessionDurations: {
      type: [Number],
      default: [30, 60],
      validate: {
        validator: (durations) => durations.every((duration) => duration > 0 && duration <= 480),
        message: "Session durations must be between 1 and 480 minutes",
      },
    },
    weeklyHours: {
      type: [dayScheduleSchema],
      default: () => [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ].map((day) => ({ day, isAvailable: false, slots: [] })),
    },
    specificDates: { type: [specificDateSchema], default: [] },
    googleCalendarConnected: { type: Boolean, default: false },
    googleCalendarToken: { type: String, default: "", select: false },
  },
  { timestamps: true },
);

availabilitySchema.index({ "specificDates.date": 1 });

module.exports = mongoose.model("Availability", availabilitySchema);
