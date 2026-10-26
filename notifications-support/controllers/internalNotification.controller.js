const createInternalNotificationController = ({ notificationService }) => ({
  create: async (req, res, next) => {
    try {
      const result = await notificationService.createFromEvent(req.body);
      return res.status(result.deduplicated ? 200 : 201).json({ success: true, data: result, message: "Notification event accepted" });
    } catch (error) { return next(error); }
  },
});

module.exports = createInternalNotificationController;
