const createSupportController = ({ supportService }) => ({
  createMessage: async (req, res, next) => {
    try {
      const ticket = await supportService.submitTicket({ ...req.body, user: req.user?._id || null });
      return res.status(201).json({ success: true, data: ticket, message: "Support ticket submitted" });
    } catch (error) { return next(error); }
  },
  getMessages: async (_req, res, next) => {
    try {
      return res.status(200).json({ success: true, data: await supportService.fetchAllTickets(), message: "Support tickets retrieved" });
    } catch (error) { return next(error); }
  },
  resolveMessage: async (req, res, next) => {
    try {
      return res.status(200).json({ success: true, data: await supportService.resolveTicket(req.params.id), message: "Support ticket resolved" });
    } catch (error) { return next(error); }
  },
});

module.exports = createSupportController;
