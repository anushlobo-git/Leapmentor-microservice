const createNotificationController = ({ notificationService }) => ({
  getNotifications: async (req, res, next) => {
    try {
      const notifications = await notificationService.getRecipientNotifications(req.user._id);
      return res.status(200).json({ success: true, data: { notifications }, message: "Notifications retrieved" });
    } catch (error) { return next(error); }
  },
  markAllRead: async (req, res, next) => {
    try {
      await notificationService.markAllNotificationsAsRead(req.user._id);
      return res.status(200).json({ success: true, data: null, message: "All notifications marked as read" });
    } catch (error) { return next(error); }
  },
  markOneRead: async (req, res, next) => {
    try {
      await notificationService.markOneNotificationAsRead(req.params.id, req.user._id);
      return res.status(200).json({ success: true, data: null, message: "Notification marked as read" });
    } catch (error) { return next(error); }
  },
  deleteNotification: async (req, res, next) => {
    try {
      await notificationService.removeNotificationRecord(req.params.id, req.user._id);
      return res.status(200).json({ success: true, data: null, message: "Notification deleted" });
    } catch (error) { return next(error); }
  },
  clearAll: async (req, res, next) => {
    try {
      await notificationService.clearAllUserNotifications(req.user._id);
      return res.status(200).json({ success: true, data: null, message: "All notifications cleared" });
    } catch (error) { return next(error); }
  },
});

module.exports = createNotificationController;
