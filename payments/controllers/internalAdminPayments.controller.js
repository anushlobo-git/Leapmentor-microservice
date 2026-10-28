const { toTransactionDTO } = require("../utils/transaction.mapper");

const createInternalAdminPaymentsController = ({ walletRepository, platformSettingsService, transactionRepository }) => ({
  getSummary: async (_req, res, next) => {
    try {
      const [commissionRate, pendingPayouts] = await Promise.all([
        platformSettingsService.getCommissionRate(),
        walletRepository.sumEscrowBalances(),
      ]);
      return res.status(200).json({ success: true, data: { commissionRate, pendingPayouts } });
    } catch (error) { return next(error); }
  },
  getTransactions: async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 15));
      const userIds = String(req.query.userIds || "").split(",").filter(Boolean).slice(0, 500);
      const filter = {};
      if (userIds.length) filter.user = { $in: userIds };
      if (req.query.type?.trim()) filter.type = req.query.type.trim();
      else filter.type = { $ne: "credit" };
      const [totalCount, rows] = await Promise.all([
        transactionRepository.countTransactions(filter),
        transactionRepository.findTransactions(filter, { skip: (page - 1) * limit, limit }),
      ]);
      return res.status(200).json({
        success: true,
        data: {
          transactions: rows.map(toTransactionDTO),
          pagination: { totalCount, currentPage: page, totalPages: Math.ceil(totalCount / limit), hasMore: page < Math.ceil(totalCount / limit) },
        },
      });
    } catch (error) { return next(error); }
  },
});

module.exports = createInternalAdminPaymentsController;