const createAdminPaymentsController = ({ paymentsService }) => ({
  getStats: async (req, res, next) => {
    try {
      return res
        .status(200)
        .json({
          success: true,
          data: await paymentsService.getStats(req.correlationId),
          message: "Payment stats retrieved",
        });
    } catch (error) {
      return next(error);
    }
  },
  getRevenueChart: async (req, res, next) => {
    try {
      return res
        .status(200)
        .json({
          success: true,
          data: await paymentsService.getRevenueChart(req.correlationId),
          message: "Revenue chart retrieved",
        });
    } catch (error) {
      return next(error);
    }
  },
  getTransactions: async (req, res, next) => {
    try {
      const result = await paymentsService.getTransactions(
        req.query,
        req.correlationId,
      );
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createAdminPaymentsController;
