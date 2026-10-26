const createSupportMessageRepository = (SupportMessage) => ({
  create: (messageData) => SupportMessage.create(messageData),
  findAllSortedByNewest: () => SupportMessage.find().sort({ createdAt: -1 }).lean(),
  updateStatusById: (id, status) => SupportMessage.findByIdAndUpdate(id, { $set: { status } }, { new: true }).lean(),
});

module.exports = createSupportMessageRepository;
