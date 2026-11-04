const crypto = require("node:crypto");

const createEarningsController = ({ earningsService }) => ({
  getEarningsSummary: async (req, res, next) => {
    try {
      return res.status(200).json({
        success: true,
        data: await earningsService.getEarningsSummaryService(
          req.user._id,
          req.correlationId,
        ),
        message: "Earnings summary retrieved",
      });
    } catch (error) {
      return next(error);
    }
  },
  getEarningsChart: async (req, res, next) => {
    try {
      const period = req.query.period === "weekly" ? "weekly" : "monthly";
      return res.status(200).json({
        success: true,
        data: await earningsService.getEarningsChartService(
          req.user._id,
          period,
          req.correlationId,
        ),
        message: "Earnings chart retrieved",
      });
    } catch (error) {
      return next(error);
    }
  },
  getPayoutHistory: async (req, res, next) => {
    try {
      return res.status(200).json({
        success: true,
        data: await earningsService.getPayoutHistoryService(
          req.user._id,
          req.query,
          req.correlationId,
        ),
        message: "Payout history retrieved",
      });
    } catch (error) {
      return next(error);
    }
  },
  withdrawEarnings: async (req, res, next) => {
    try {
      const suppliedKey = req.get("Idempotency-Key");
      const idempotencyKey =
        suppliedKey ||
        `earnings-withdrawal:${req.user._id}:${crypto.randomUUID()}`;
      return res.status(200).json({
        success: true,
        data: await earningsService.withdrawEarningsService(
          req.user._id,
          idempotencyKey,
          req.correlationId,
        ),
        message: "Withdrawal request submitted successfully",
      });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createEarningsController;
