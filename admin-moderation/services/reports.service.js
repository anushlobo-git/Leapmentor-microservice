const AppError = require("../utils/AppError");

const createReportsService = ({ workspaceClient, paymentsClient }) => ({
  getStats: async (correlationId) => (await workspaceClient.getReportStats(correlationId))?.data || {},
  getReports: async (query, correlationId) => (await workspaceClient.listReports(query, correlationId))?.data || { reports: [], pagination: {} },
  updateReport: async (reportId, { status, adminNote }, adminId, correlationId) => {
    const response = await workspaceClient.updateReport(reportId, { status, adminNote, resolvedBy: adminId }, correlationId);
    return response?.data?.report || null;
  },
  processRefund: async (reportId, adminNote, adminId, correlationId) => {
    const detail = await workspaceClient.getReport(reportId, correlationId);
    const report = detail?.data?.report;
    const request = detail?.data?.connectRequest;
    if (!report) throw new AppError("Report not found", 404, "REPORT_NOT_FOUND");
    if (report.complaintType !== "refund") throw new AppError("This report is not a refund request", 400, "NOT_REFUND_REPORT");
    if (report.refundProcessed) throw new AppError("Refund already processed", 409, "REFUND_ALREADY_PROCESSED");
    if (!request?._id) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    const payment = await paymentsClient.refund(request._id, correlationId);
    await workspaceClient.updateReport(reportId, {
      status: "resolved",
      adminNote: adminNote || "Refund processed by admin.",
      resolvedBy: adminId,
      refundProcessed: true,
    }, correlationId);
    return { refundAmount: payment?.data?.totalAmount || 0 };
  },
  deleteSession: async (reportId, adminNote, adminId, correlationId) => {
    const response = await workspaceClient.deleteSession(reportId, { adminNote, resolvedBy: adminId }, correlationId);
    return response?.data || null;
  },
});

module.exports = createReportsService;
