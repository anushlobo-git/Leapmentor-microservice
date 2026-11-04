const createSettingsController = ({ settingsService }) => ({
  getOverview: async (req, res, next) => {
    try {
      const data = await settingsService.getOverview(req.correlationId);
      return res.status(200).json({ success: true, data, message: "Settings overview retrieved" });
    } catch (error) { return next(error); }
  },
  addAdmin: async (req, res, next) => {
    try {
      const data = await settingsService.addAdmin(req.body);
      return res.status(201).json({ success: true, data, message: "Admin account created" });
    } catch (error) { return next(error); }
  },
  changePassword: async (req, res, next) => {
    try {
      await settingsService.changePassword(req.admin._id, req.body);
      return res.status(200).json({ success: true, data: null, message: "Password changed successfully" });
    } catch (error) { return next(error); }
  },
  getCommission: async (req, res, next) => {
    try {
      const commissionRate = await settingsService.getCommission(req.admin._id, req.correlationId);
      return res.status(200).json({ success: true, data: { commissionRate }, message: "Commission rate retrieved" });
    } catch (error) { return next(error); }
  },
  updateCommission: async (req, res, next) => {
    try {
      const commissionRate = await settingsService.updateCommission(
        req.admin._id,
        req.body.commissionRate,
        req.correlationId,
      );
      return res.status(200).json({ success: true, data: { commissionRate }, message: "Commission rate updated" });
    } catch (error) { return next(error); }
  },
});

module.exports = createSettingsController;
