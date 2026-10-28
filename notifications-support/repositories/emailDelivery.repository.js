const createEmailDeliveryRepository = (EmailDelivery) => ({
  findBySourceEventId: (sourceEventId) =>
    EmailDelivery.findOne({ sourceEventId }).lean(),
  createPending: (sourceEventId) =>
    EmailDelivery.create({ sourceEventId, status: "pending" }),
  markSent: (sourceEventId) =>
    EmailDelivery.findOneAndUpdate(
      { sourceEventId },
      { $set: { status: "sent", sentAt: new Date(), lastError: "" } },
      { new: true },
    ),
  markFailed: (sourceEventId, error) =>
    EmailDelivery.findOneAndUpdate(
      { sourceEventId },
      { $set: { status: "failed", lastError: String(error).slice(0, 1000) } },
      { new: true },
    ),
});

module.exports = createEmailDeliveryRepository;
