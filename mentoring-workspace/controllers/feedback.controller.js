const createFeedbackController = ({ feedbackService }) => {
  const createFeedback = async (req, res, next) => {
    try {
      const feedback = await feedbackService.createFeedback({
        connectRequestId: req.body.connectRequestId,
        rating: req.body.rating,
        comment: req.body.comment,
        slotIndex: req.body.slotIndex,
        userId: req.user._id,
        correlationId: req.correlationId,
      });
      return res.status(201).json({
        success: true,
        data: { feedback },
        message: "Feedback submitted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getFeedback = async (req, res, next) => {
    try {
      const feedback = await feedbackService.getFeedback(
        req.params.connectRequestId,
        req.user._id,
        req.correlationId,
      );
      return res.status(200).json({
        success: true,
        data: feedback,
        message: "Feedback retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { createFeedback, getFeedback };
};

module.exports = createFeedbackController;
