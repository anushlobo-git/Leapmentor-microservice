const createInternalPaymentController = ({
  connectRequestPaymentRepository,
  profileClient,
}) => {
  const getPaymentContext = async (req, res, next) => {
    try {
      const context = await connectRequestPaymentRepository.findPaymentContext(
        req.params.id,
      );
      if (!context) {
        return res.status(404).json({
          error: "Connect request not found",
          code: "CONNECT_REQUEST_NOT_FOUND",
        });
      }
      let paymentContext = context;
      if (paymentContext.sessionRate == null && paymentContext.mentor) {
        const profile = await profileClient?.getMentorProfile?.(
          paymentContext.mentor,
          req.correlationId,
        );
        const sessionRate = Number(profile?.hourlyRate);
        const sessionCount =
          paymentContext.sessionCount || paymentContext.selectedSlots?.length;
        if (Number.isFinite(sessionRate) && sessionRate >= 1 && sessionCount >= 1) {
          paymentContext = {
            ...paymentContext,
            sessionRate,
            sessionCount,
            totalAmount: sessionRate * sessionCount,
          };
        }
      }
      return res.status(200).json({
        success: true,
        data: paymentContext,
        message: "Payment context retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const updatePaymentState = async (req, res, next) => {
    try {
      const context = await connectRequestPaymentRepository.updatePaymentState(
        req.params.id,
        req.body || {},
      );
      if (!context) {
        return res.status(404).json({
          error: "Connect request not found",
          code: "CONNECT_REQUEST_NOT_FOUND",
        });
      }
      return res.status(200).json({
        success: true,
        data: context,
        message: "Payment state updated",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getPaymentContext, updatePaymentState };
};

module.exports = createInternalPaymentController;
