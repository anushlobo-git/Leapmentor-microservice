const createSessionController = ({ sessionService }) => ({
  getSlots: async (req, res, next) => {
    try {
      return res
        .status(200)
        .json({
          success: true,
          data: await sessionService.getSlots(
            req.params.connectRequestId,
            req.user._id,
          ),
          message: "Session slots retrieved",
        });
    } catch (error) {
      return next(error);
    }
  },
  setMeetingLink: async (req, res, next) => {
    try {
      return res
        .status(200)
        .json({
          success: true,
          data: await sessionService.setMeetingLink({
            connectRequestId: req.params.connectRequestId,
            slotIndex: req.params.slotIndex,
            meetingLink: req.body.meetingLink,
            userId: req.user._id,
          }),
          message: "Meeting link updated",
        });
    } catch (error) {
      return next(error);
    }
  },
  markSlotComplete: async (req, res, next) => {
    try {
      return res
        .status(200)
        .json({
          success: true,
          data: await sessionService.markSlotComplete({
            connectRequestId: req.params.connectRequestId,
            slotIndex: req.params.slotIndex,
            userId: req.user._id,
            correlationId: req.correlationId,
          }),
          message: "Slot marked complete",
        });
    } catch (error) {
      return next(error);
    }
  },
  addSlot: async (req, res, next) => {
    try {
      return res
        .status(201)
        .json({
          success: true,
          data: await sessionService.addSlot({
            connectRequestId: req.params.connectRequestId,
            ...req.body,
            userId: req.user._id,
            correlationId: req.correlationId,
          }),
          message: "Additional session slot added successfully",
        });
    } catch (error) {
      return next(error);
    }
  },
  cancelSlot: async (req, res, next) => {
    try {
      return res
        .status(200)
        .json({
          success: true,
          data: await sessionService.cancelSlot({
            connectRequestId: req.params.connectRequestId,
            slotIndex: req.params.slotIndex,
            reason: req.body.reason,
            userId: req.user._id,
            correlationId: req.correlationId,
          }),
          message: "Slot cancelled successfully",
        });
    } catch (error) {
      return next(error);
    }
  },
  rescheduleSlot: async (req, res, next) => {
    try {
      return res
        .status(200)
        .json({
          success: true,
          data: await sessionService.rescheduleSlot({
            connectRequestId: req.params.connectRequestId,
            slotIndex: req.params.slotIndex,
            ...req.body,
            userId: req.user._id,
            correlationId: req.correlationId,
          }),
          message: "Slot rescheduled successfully",
        });
    } catch (error) {
      return next(error);
    }
  },
  getMentorAvailability: async (req, res, next) => {
    try {
      return res
        .status(200)
        .json({
          success: true,
          data: await sessionService.getMentorAvailability(
            req.params.connectRequestId,
            Number.parseInt(req.query.duration, 10) || 60,
            req.user._id,
            req.correlationId,
          ),
          message: "Mentor availability retrieved",
        });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createSessionController;
