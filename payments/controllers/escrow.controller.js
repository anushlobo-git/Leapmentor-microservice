const createEscrowController = ({ escrowService }) => {
  const pay = async (req, res, next) => {
    try {
      const result = await escrowService.pay({
        ...req.body,
        menteeId: req.user._id,
        correlationId: req.correlationId,
      });
      return res.status(200).json({ success: true, data: result, message: "Payment successful. Tokens locked in escrow." });
    } catch (error) {
      return next(error);
    }
  };

  const payAdditional = async (req, res, next) => {
    try {
      const result = await escrowService.payAdditional({
        ...req.body,
        menteeId: req.user._id,
        correlationId: req.correlationId,
      });
      return res.status(200).json({ success: true, data: result, message: "Additional session payment successful. Tokens locked in escrow." });
    } catch (error) {
      return next(error);
    }
  };

  const release = async (req, res, next) => {
    try {
      const result = await escrowService.release({
        requestId: req.params.requestId,
        menteeId: req.user._id,
        correlationId: req.correlationId,
      });
      return res.status(200).json({ success: true, data: result, message: "Session marked complete. Tokens released to mentor." });
    } catch (error) {
      return next(error);
    }
  };

  const refund = async (req, res, next) => {
    try {
      const result = await escrowService.refund({
        requestId: req.params.requestId,
        userId: req.user._id,
        correlationId: req.correlationId,
      });
      return res.status(200).json({ success: true, data: result, message: "Escrow refunded successfully. Tokens returned to mentee." });
    } catch (error) {
      return next(error);
    }
  };

  const getStatus = async (req, res, next) => {
    try {
      const result = await escrowService.getStatus({
        requestId: req.params.requestId,
        userId: req.user._id,
        correlationId: req.correlationId,
      });
      return res.status(200).json({ success: true, data: result, message: "Escrow status retrieved" });
    } catch (error) {
      return next(error);
    }
  };

  return { pay, payAdditional, release, refund, getStatus };
};

module.exports = createEscrowController;
