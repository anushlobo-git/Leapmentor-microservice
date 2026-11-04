const mongoose = require("mongoose");

const outboxEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    sourceEventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    correlationId: { type: String, default: "not-provided" },
    status: { type: String, enum: ["pending", "delivered"], default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String, default: "" },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true },
);

outboxEventSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model("OutboxEvent", outboxEventSchema);
