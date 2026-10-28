const RETRY_DELAYS_MS = [1000, 5000, 30000, 60000];

const createOutboxRepository = (OutboxEvent) => {
  const enqueue = async ({ eventId, sourceEventId, eventType, payload, correlationId }) => {
    try {
      return await OutboxEvent.findOneAndUpdate(
        { sourceEventId },
        {
          $setOnInsert: {
            eventId,
            sourceEventId,
            eventType,
            payload,
            correlationId: correlationId || "not-provided",
            status: "pending",
            attempts: 0,
            nextAttemptAt: new Date(),
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ).lean();
    } catch (error) {
      if (error?.code !== 11000) throw error;
      return OutboxEvent.findOne({ sourceEventId }).lean();
    }
  };

  const findPending = (limit = 50) => OutboxEvent.find({
    status: "pending",
    nextAttemptAt: { $lte: new Date() },
  }).sort({ createdAt: 1 }).limit(limit).lean();

  const markDelivered = (id) => OutboxEvent.findByIdAndUpdate(id, {
    $set: { status: "delivered", deliveredAt: new Date(), lastError: "" },
  }, { new: true }).lean();

  const markFailed = (id, errorMessage, previousAttempts = 0) => OutboxEvent.findByIdAndUpdate(id, {
    $inc: { attempts: 1 },
    $set: {
      lastError: String(errorMessage || "OUTBOX_DELIVERY_FAILED").slice(0, 500),
      nextAttemptAt: new Date(Date.now() + RETRY_DELAYS_MS[Math.min(RETRY_DELAYS_MS.length - 1, Number(previousAttempts) || 0)]),
    },
  }, { new: true }).lean();

  return { enqueue, findPending, markDelivered, markFailed };
};

module.exports = createOutboxRepository;
