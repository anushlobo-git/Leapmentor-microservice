const stringifyId = (value) => value?._id?.toString?.() || value?.toString?.() || value || null;

const toNotificationDTO = (notification) => {
  if (!notification) return null;
  return {
    _id: stringifyId(notification._id),
    id: stringifyId(notification._id),
    recipient: stringifyId(notification.recipient),
    type: notification.type || "",
    title: notification.title || "",
    message: notification.message || "",
    read: notification.read === true,
    metadata: notification.metadata || {},
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
};

module.exports = { toNotificationDTO };
