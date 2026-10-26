const createInternalPaymentController = ({ connectRequestPaymentRepository }) => {
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
      return res.status(200).json({
        success: true,
        data: context,
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
