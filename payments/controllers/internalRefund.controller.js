const createInternalRefundController = ({ escrowService }) => ({
  refund: async (req, res, next) => {
    try {
      const data = await escrowService.adminRefund({
        requestId: req.body?.requestId,
        correlationId: req.get("X-Correlation-ID"),
      });
      return res.status(200).json({ success: true, data, message: "Refund processed" });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createInternalRefundController;
