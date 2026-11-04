const createMessageController = ({ messageService }) => ({
  getMessages: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await messageService.getChatHistory(req.params.connectRequestId, req.user._id, req.query), message: "Messages retrieved" }); } catch (error) { return next(error); }
  },
  getUnreadCount: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await messageService.getUnreadMessagesCount(req.params.connectRequestId, req.user._id), message: "Unread count retrieved" }); } catch (error) { return next(error); }
  },
});

module.exports = createMessageController;
