const createInternalSettingsController = ({ platformSettingsService }) => ({
  getCommission: async (_req, res, next) => {
    try {
      const commissionRate = await platformSettingsService.getCommissionRate();
      return res.status(200).json({
        success: true,
        data: { commissionRate },
        message: "Commission rate retrieved",
      });
    } catch (error) {
      return next(error);
    }
  },
  updateCommission: async (req, res, next) => {
    try {
      const commissionRate = await platformSettingsService.updateCommissionRate(
        req.body?.commissionRate,
      );
      return res.status(200).json({
        success: true,
        data: { commissionRate },
        message: "Commission rate updated",
      });
    } catch (error) {
      return next(error);
    }
  },
});

module.exports = createInternalSettingsController;
