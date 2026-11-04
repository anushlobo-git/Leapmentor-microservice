const createInternalEscrowController = ({ escrowService }) => ({
  release: async (req, res, next) => {
    try {
      const result = await escrowService.release({
        requestId: req.body?.connectRequestId,
        menteeId: req.body?.menteeId,
        correlationId: req.correlationId,
      });
      return res.status(200).json({ success: true, data: result, message: "Escrow released" });
    } catch (error) { return next(error); }
  },
});

module.exports = createInternalEscrowController;
