const createEmailDeliveryRepository = (EmailDelivery) => ({
  findBySourceEventId: (sourceEventId) =>
    EmailDelivery.findOne({ sourceEventId }).lean(),
  createPending: (sourceEventId, payload) =>
    EmailDelivery.create({ sourceEventId, payload, status: "pending" }),
  findPending: (limit = 50) =>
    EmailDelivery.find({
      $or: [
        {
          status: { $in: ["pending", "failed"] },
          nextAttemptAt: { $lte: new Date() },
        },
        { status: "sending", lockedUntil: { $lte: new Date() } },
      ],
      payload: { $ne: null },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean(),
  claimForSending: (sourceEventId) =>
    EmailDelivery.findOneAndUpdate(
      {
        sourceEventId,
        $or: [
          {
            status: { $in: ["pending", "failed"] },
            nextAttemptAt: { $lte: new Date() },
          },
          { status: "sending", lockedUntil: { $lte: new Date() } },
        ],
      },
      {
        $set: {
          status: "sending",
          lockedUntil: new Date(Date.now() + 120_000),
        },
      },
      { new: true },
    ).lean(),
  markSent: (sourceEventId) =>
    EmailDelivery.findOneAndUpdate(
      { sourceEventId },
      {
        $set: { status: "sent", sentAt: new Date(), lastError: "" },
        $unset: { lockedUntil: 1 },
      },
      { new: true },
    ),
  markFailed: (sourceEventId, error) =>
    EmailDelivery.findOneAndUpdate(
      { sourceEventId },
      {
        $set: {
          status: "failed",
          lastError: String(error).slice(0, 1000),
          nextAttemptAt: new Date(Date.now() + 60_000),
        },
        $unset: { lockedUntil: 1 },
        $inc: { attempts: 1 },
      },
      { new: true },
    ),
});

module.exports = createEmailDeliveryRepository;
