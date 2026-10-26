const AppError = require("../utils/AppError");
const { toNotificationDTO } = require("../utils/notification.mapper");

const NOTIFICATION_RETRIEVAL_LIMIT = 50;
const NOTIFICATION_TYPES = new Set([
  "connect_request_received",
  "connect_request_accepted",
  "connect_request_declined",
  "upcoming_session",
  "new_message",
  "session_completed",
  "new_review",
  "support_resolved",
]);

const createNotificationService = ({ notificationRepository }) => {
  const getRecipientNotifications = async (recipientId) => {
    const notifications = await notificationRepository.findByRecipientLimit(
      recipientId,
      NOTIFICATION_RETRIEVAL_LIMIT,
    );
    return notifications.map(toNotificationDTO);
  };

  const markAllNotificationsAsRead = async (recipientId) => {
    await notificationRepository.updateManyReadStatus(recipientId, false, true);
  };

  const markOneNotificationAsRead = async (notificationId, recipientId) => {
    const updatedNotification = await notificationRepository.findOneAndUpdateByRecipient(
      notificationId,
      recipientId,
      { read: true },
    );
    if (!updatedNotification) {
      throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
    }
  };

  const removeNotificationRecord = async (notificationId, recipientId) => {
    const deletedNotification = await notificationRepository.deleteOneByRecipient(
      notificationId,
      recipientId,
    );
    if (!deletedNotification) {
      throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
    }
  };

  const clearAllUserNotifications = async (recipientId) => {
    await notificationRepository.deleteManyByRecipient(recipientId);
  };

  const createFromEvent = async (payload) => {
    const { sourceEventId, recipient, type, title, message, metadata } = payload || {};
    if (!sourceEventId || !recipient || !type || !title || !message) {
      throw new AppError("sourceEventId, recipient, type, title, and message are required", 400, "INVALID_NOTIFICATION_EVENT");
    }
    if (!NOTIFICATION_TYPES.has(type)) {
      throw new AppError("Unsupported notification type", 400, "INVALID_NOTIFICATION_TYPE");
    }
    const existing = await notificationRepository.findBySourceEventId(sourceEventId);
    if (existing) return { notification: toNotificationDTO(existing), deduplicated: true };
    const notification = await notificationRepository.createNotification({
      sourceEventId,
      recipient,
      type,
      title: String(title).trim(),
      message: String(message).trim(),
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });
    return { notification: toNotificationDTO(notification), deduplicated: false };
  };

  return {
    getRecipientNotifications,
    markAllNotificationsAsRead,
    markOneNotificationAsRead,
    removeNotificationRecord,
    clearAllUserNotifications,
    createFromEvent,
  };
};

module.exports = createNotificationService;
