const toMessageDTO = (message) => ({
  _id: message._id?.toString?.() || message._id,
  connectRequest: message.connectRequest?.toString?.() || message.connectRequest,
  sender: message.sender?.toString?.() || message.sender,
  content: message.content || "",
  readAt: message.readAt || null,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

module.exports = { toMessageDTO };
