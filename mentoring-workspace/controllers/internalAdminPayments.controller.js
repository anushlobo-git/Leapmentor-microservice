const CHART_MONTHS = 6;

const createInternalAdminPaymentsController = ({
  connectRequestRepository,
}) => ({
  getStats: async (_req, res, next) => {
    try {
      const [sessions, refundedRequests] = await Promise.all([
        connectRequestRepository.findCompletedPaidSessions(),
        connectRequestRepository.countRefundedRequests(),
      ]);
      const totals = sessions.reduce(
        (result, session) => ({
          totalRevenue: result.totalRevenue + (session.totalAmount || 0),
          platformCommission:
            result.platformCommission + (session.commissionAmount || 0),
        }),
        { totalRevenue: 0, platformCommission: 0 },
      );
      return res
        .status(200)
        .json({ success: true, data: { ...totals, refundedRequests } });
    } catch (error) {
      return next(error);
    }
  },
  getChart: async (_req, res, next) => {
    try {
      const now = new Date();
      const chart = await Promise.all(
        Array.from({ length: CHART_MONTHS }, async (_unused, index) => {
          const offset = CHART_MONTHS - index - 1;
          const monthStart = new Date(
            now.getFullYear(),
            now.getMonth() - offset,
            1,
          );
          const monthEnd = new Date(
            now.getFullYear(),
            now.getMonth() - offset + 1,
            1,
          );
          const sessions = await connectRequestRepository.findSessionsByMonth(
            monthStart,
            monthEnd,
          );
          return {
            label: monthStart
              .toLocaleString("en-US", { month: "short" })
              .toUpperCase(),
            amount: sessions.reduce(
              (total, session) => total + (session.totalAmount || 0),
              0,
            ),
          };
        }),
      );
      return res.status(200).json({ success: true, data: chart });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createInternalAdminPaymentsController;
