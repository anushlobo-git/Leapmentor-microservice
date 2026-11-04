const createMessageRepository = (Message) => ({
  createMessage: (data) => Message.create(data),
  findById: (id) => Message.findById(id).lean(),
  findPaginatedMessages: (connectRequest, skip, limit) =>
    Message.find({ connectRequest }).sort({ createdAt: 1 }).skip(skip).limit(limit).lean(),
  countMessages: (connectRequest) => Message.countDocuments({ connectRequest }),
  markMessagesAsRead: (connectRequest, userId) =>
    Message.updateMany({ connectRequest, sender: { $ne: userId }, readAt: null }, { $set: { readAt: new Date() } }),
  markMessageAsRead: (messageId) =>
    Message.findByIdAndUpdate(messageId, { $set: { readAt: new Date() } }, { new: true }).lean(),
  countUnreadMessages: (connectRequest, userId) =>
    Message.countDocuments({ connectRequest, sender: { $ne: userId }, readAt: null }),
});

module.exports = createMessageRepository;
