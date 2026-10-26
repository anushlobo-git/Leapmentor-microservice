const mongoose = require("mongoose");

const STATUSES = ["open", "under_review", "resolved", "dismissed"];

const createInternalAdminReportsController = ({
  reportRepository,
  connectRequestRepository,
  notificationClient,
}) => {
  const validId = (value) => mongoose.Types.ObjectId.isValid(value);

  const getStats = async (_req, res, next) => {
    try {
      const [totalReports, pendingResolution, resolvedToday] = await Promise.all([
        reportRepository.countAllReports(),
        reportRepository.countReportsByFilter({ status: { $in: ["open", "under_review"] } }),
        reportRepository.countReportsByFilter({ status: "resolved", resolvedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      ]);
      return res.status(200).json({ success: true, data: { totalReports, pendingResolution, resolvedToday }, message: "Report stats retrieved" });
    } catch (error) { return next(error); }
  };

  const getReports = async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
      const filter = req.query.status ? { status: req.query.status } : {};
      const [total, reports] = await Promise.all([
        reportRepository.countReportsByFilter(filter),
        reportRepository.findReports(filter, { skip: (page - 1) * limit, limit }),
      ]);
      return res.status(200).json({
        success: true,
        data: {
          reports,
          pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        },
        message: "Reports retrieved",
      });
    } catch (error) { return next(error); }
  };

  const getReport = async (req, res, next) => {
    if (!validId(req.params.reportId)) return res.status(400).json({ error: "Invalid report id", code: "INVALID_REPORT_ID" });
    try {
      const report = await reportRepository.findById(req.params.reportId);
      if (!report) return res.status(404).json({ error: "Report not found", code: "REPORT_NOT_FOUND" });
      const connectRequest = report.connectRequest
        ? await connectRequestRepository.findById(report.connectRequest)
        : null;
      return res.status(200).json({ success: true, data: { report, connectRequest }, message: "Report retrieved" });
    } catch (error) { return next(error); }
  };

  const updateReport = async (req, res, next) => {
    if (!validId(req.params.reportId)) return res.status(400).json({ error: "Invalid report id", code: "INVALID_REPORT_ID" });
    const { status, adminNote, resolvedBy, refundProcessed } = req.body || {};
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid report status", code: "INVALID_REPORT_STATUS" });
    try {
      const update = { status };
      if (adminNote !== undefined) update.adminNote = String(adminNote).trim();
      if (resolvedBy) update.resolvedBy = resolvedBy;
      if (refundProcessed === true) {
        update.refundProcessed = true;
        update.refundedAt = new Date();
      }
      if (["resolved", "dismissed"].includes(status)) update.resolvedAt = new Date();
      const report = await reportRepository.updateById(req.params.reportId, update);
      if (!report) return res.status(404).json({ error: "Report not found", code: "REPORT_NOT_FOUND" });
      if (["resolved", "dismissed"].includes(status) && report.reportedBy) {
        await notificationClient.publish({
          sourceEventId: `admin-report-status:${report._id}:${status}:${report.resolvedAt?.toISOString?.() || "now"}`,
          recipient: report.reportedBy.toString(),
          type: "new_review",
          title: status === "resolved" ? "Your report has been resolved" : "Your report has been dismissed",
          message: adminNote?.trim()
            ? `Your report was reviewed by the admin team. Note: ${adminNote.trim()}`
            : "Your report was reviewed by the admin team.",
          metadata: { reportId: report._id.toString(), status },
        }, req.correlationId);
      }
      return res.status(200).json({ success: true, data: { report }, message: "Report updated" });
    } catch (error) { return next(error); }
  };

  const deleteSession = async (req, res, next) => {
    if (!validId(req.params.reportId)) return res.status(400).json({ error: "Invalid report id", code: "INVALID_REPORT_ID" });
    try {
      const report = await reportRepository.findById(req.params.reportId);
      if (!report) return res.status(404).json({ error: "Report not found", code: "REPORT_NOT_FOUND" });
      const request = report.connectRequest ? await connectRequestRepository.findById(report.connectRequest) : null;
      if (!request) return res.status(404).json({ error: "Session not found", code: "SESSION_NOT_FOUND" });
      await connectRequestRepository.deleteRequestById(request._id);
      await reportRepository.updateById(report._id, {
        status: "resolved",
        adminNote: String(req.body?.adminNote || "Session deleted by admin.").trim(),
        resolvedBy: req.body?.resolvedBy || null,
        resolvedAt: new Date(),
      });
      for (const recipient of [request.mentee, request.mentor].filter(Boolean)) {
        await notificationClient.publish({
          sourceEventId: `admin-report-session-deleted:${report._id}:${recipient}`,
          recipient: recipient.toString(),
          type: "new_review",
          title: "Session removed by admin",
          message: "Your reported session has been removed by the admin team.",
          metadata: { reportId: report._id.toString(), requestId: request._id.toString() },
        }, req.correlationId);
      }
      return res.status(200).json({ success: true, data: null, message: "Session deleted" });
    } catch (error) { return next(error); }
  };

  return { getStats, getReports, getReport, updateReport, deleteSession };
};

module.exports = createInternalAdminReportsController;
