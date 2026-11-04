const toSupportMessageDTO = (message) => {
  if (!message) return null;
  return {
    _id: message._id?.toString?.() || message._id,
    user: message.user?.toString?.() || message.user || null,
    email: message.email || "",
    subject: message.subject || "",
    message: message.message || "",
    role: message.role || "user",
    status: message.status || "open",
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

module.exports = { toSupportMessageDTO };
