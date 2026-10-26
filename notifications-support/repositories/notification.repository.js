const createNotificationRepository = (Notification) => ({
  findBySourceEventId: (sourceEventId) => Notification.findOne({ sourceEventId }).lean(),
  findByRecipientLimit: (recipientId, limit) =>
    Notification.find({ recipient: recipientId }).sort({ createdAt: -1 }).limit(limit).lean(),
  updateManyReadStatus: (recipientId, currentReadStatus, newReadStatus) =>
    Notification.updateMany(
      { recipient: recipientId, read: currentReadStatus },
      { $set: { read: newReadStatus } },
    ),
  findOneAndUpdateByRecipient: (notificationId, recipientId, updateData) =>
    Notification.findOneAndUpdate(
      { _id: notificationId, recipient: recipientId },
      { $set: updateData },
      { new: true },
    ).lean(),
  deleteOneByRecipient: (notificationId, recipientId) =>
    Notification.findOneAndDelete({ _id: notificationId, recipient: recipientId }),
  deleteManyByRecipient: (recipientId) => Notification.deleteMany({ recipient: recipientId }),
  createNotification: (notificationData) => Notification.create(notificationData),
});

module.exports = createNotificationRepository;
