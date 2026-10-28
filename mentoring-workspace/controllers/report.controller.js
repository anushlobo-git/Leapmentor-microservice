const createReportController = ({ reportService }) => ({
  submitReport: async (req, res, next) => {
    try {
      const report = await reportService.createIncidentReport({
        userId: req.user._id,
        body: req.body,
        file: req.file,
        correlationId: req.correlationId,
      });
      return res.status(201).json({ success: true, data: { report }, message: "Report submitted successfully. Our team will review it shortly." });
    } catch (error) { return next(error); }
  },
  getMyReport: async (req, res, next) => {
    try {
      const data = await reportService.getMySessionReport(req.params.connectRequestId, req.user._id);
      return res.status(200).json({ success: true, data, message: "Session report retrieved" });
    } catch (error) { return next(error); }
  },
});

module.exports = createReportController;
