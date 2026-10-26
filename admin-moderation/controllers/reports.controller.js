const createReportsController = ({ reportsService }) => ({
  getStats: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await reportsService.getStats(req.correlationId), message: "Report stats retrieved" }); }
    catch (error) { return next(error); }
  },
  getReports: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await reportsService.getReports(req.query, req.correlationId), message: "Reports retrieved" }); }
    catch (error) { return next(error); }
  },
  updateReport: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: { report: await reportsService.updateReport(req.params.reportId, req.body, req.admin._id, req.correlationId) }, message: "Report updated" }); }
    catch (error) { return next(error); }
  },
  processRefund: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await reportsService.processRefund(req.params.reportId, req.body?.adminNote, req.admin._id, req.correlationId), message: "Refund processed" }); }
    catch (error) { return next(error); }
  },
  deleteSession: async (req, res, next) => {
    try { return res.status(200).json({ success: true, data: await reportsService.deleteSession(req.params.reportId, req.body?.adminNote, req.admin._id, req.correlationId), message: "Session deleted" }); }
    catch (error) { return next(error); }
  },
});

module.exports = createReportsController;
