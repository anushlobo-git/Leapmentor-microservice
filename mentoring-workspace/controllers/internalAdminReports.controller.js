const mongoose = require("mongoose");

const STATUSES = ["open", "under_review", "resolved", "dismissed"];

const createInternalAdminReportsController = ({
  reportRepository,
  connectRequestRepository,
  notificationClient,
  identityClient,
}) => {
  const validId = (value) => mongoose.Types.ObjectId.isValid(value);
  const idOf = (value) => value?._id?.toString?.() || value?.toString?.() || value;

  const decorateReports = async (reports, connectRequests, correlationId) => {
    const requestsById = new Map(
      connectRequests.filter(Boolean).map((request) => [idOf(request._id), request]),
    );
    const ids = reports.flatMap((report) => {
      const request = requestsById.get(idOf(report.connectRequest));
      return [
        idOf(report.reportedBy),
        idOf(report.reportedUser),
        idOf(request?.mentee),
        idOf(request?.mentor),
      ].filter(Boolean);
    });
    const users = identityClient?.getUserSummaries
      ? await identityClient.getUserSummaries(ids, correlationId)
      : [];
    const usersById = new Map((users || []).map((user) => [idOf(user._id), user]));

    return reports.map((report) => {
      const request = requestsById.get(idOf(report.connectRequest));
      const reportedBy = usersById.get(idOf(report.reportedBy)) || report.reportedBy;
      const reportedUser = usersById.get(idOf(report.reportedUser)) || report.reportedUser;
      const menteeUser = usersById.get(idOf(request?.mentee));
      const mentorUser = usersById.get(idOf(request?.mentor));
      const mentee = report.reporterRole === "mentee" ? reportedBy : reportedUser;
      const mentor = report.reporterRole === "mentor" ? reportedBy : reportedUser;

      return {
        ...report,
        _id: idOf(report._id),
        id: idOf(report._id),
        mentee: menteeUser?.name || mentee?.name || idOf(mentee) || "—",
        menteeEmail: menteeUser?.email || mentee?.email || "",
        mentor: mentorUser?.name || mentor?.name || idOf(mentor) || "—",
        mentorEmail: mentorUser?.email || mentor?.email || "",
        reportedBy: reportedBy?.name || idOf(reportedBy) || "—",
        reportedById: idOf(reportedBy),
        reportedUser: reportedUser?.name || idOf(reportedUser) || "—",
        category: report.complaintType || "",
        connectRequestId: idOf(report.connectRequest),
        sessionStatus: request?.status || null,
        paymentStatus: request?.paymentStatus || null,
        totalAmount: request?.totalAmount || 0,
        date: report.createdAt
          ? new Date(report.createdAt).toISOString().split("T")[0]
          : "—",
      };
    });
  };

  const getStats = async (_req, res, next) => {
    try {
      const [totalReports, pendingResolution, resolvedToday] =
        await Promise.all([
          reportRepository.countAllReports(),
          reportRepository.countReportsByFilter({
            status: { $in: ["open", "under_review"] },
          }),
          reportRepository.countReportsByFilter({
            status: "resolved",
            resolvedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          }),
        ]);
      return res
        .status(200)
        .json({
          success: true,
          data: { totalReports, pendingResolution, resolvedToday },
          message: "Report stats retrieved",
        });
    } catch (error) {
      return next(error);
    }
  };

  const getReports = async (req, res, next) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number.parseInt(req.query.limit, 10) || 20),
      );
      const filter = req.query.status ? { status: req.query.status } : {};
      const [total, reports] = await Promise.all([
        reportRepository.countReportsByFilter(filter),
        reportRepository.findReports(filter, {
          skip: (page - 1) * limit,
          limit,
        }),
      ]);
      const connectRequests = await Promise.all(
        reports.map((report) =>
          report.connectRequest
            ? connectRequestRepository.findById(report.connectRequest)
            : null,
        ),
      );
      return res.status(200).json({
        success: true,
        data: {
          reports: await decorateReports(reports, connectRequests, req.correlationId),
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        message: "Reports retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getReport = async (req, res, next) => {
    if (!validId(req.params.reportId))
      return res
        .status(400)
        .json({ error: "Invalid report id", code: "INVALID_REPORT_ID" });
    try {
      const report = await reportRepository.findById(req.params.reportId);
      if (!report)
        return res
          .status(404)
          .json({ error: "Report not found", code: "REPORT_NOT_FOUND" });
      const connectRequest = report.connectRequest
        ? await connectRequestRepository.findById(report.connectRequest)
        : null;
      const [decoratedReport] = await decorateReports(
        [report],
        [connectRequest],
        req.correlationId,
      );
      return res
        .status(200)
        .json({
          success: true,
          data: { report: decoratedReport, connectRequest },
          message: "Report retrieved",
        });
    } catch (error) {
      return next(error);
    }
  };

  const updateReport = async (req, res, next) => {
    if (!validId(req.params.reportId))
      return res
        .status(400)
        .json({ error: "Invalid report id", code: "INVALID_REPORT_ID" });
    const { status, adminNote, resolvedBy, refundProcessed } = req.body || {};
    if (!STATUSES.includes(status))
      return res
        .status(400)
        .json({
          error: "Invalid report status",
          code: "INVALID_REPORT_STATUS",
        });
    try {
      const update = { status };
      if (adminNote !== undefined) update.adminNote = String(adminNote).trim();
      if (resolvedBy) update.resolvedBy = resolvedBy;
      if (refundProcessed === true) {
        update.refundProcessed = true;
        update.refundedAt = new Date();
      }
      if (["resolved", "dismissed"].includes(status))
        update.resolvedAt = new Date();
      const report = await reportRepository.updateById(
        req.params.reportId,
        update,
      );
      if (!report)
        return res
          .status(404)
          .json({ error: "Report not found", code: "REPORT_NOT_FOUND" });
      if (["resolved", "dismissed"].includes(status) && report.reportedBy) {
        await notificationClient.publish(
          {
            sourceEventId: `admin-report-status:${report._id}:${status}:${report.resolvedAt?.toISOString?.() || "now"}`,
            recipient: report.reportedBy.toString(),
            type: "new_review",
            title:
              status === "resolved"
                ? "Your report has been resolved"
                : "Your report has been dismissed",
            message: adminNote?.trim()
              ? `Your report was reviewed by the admin team. Note: ${adminNote.trim()}`
              : "Your report was reviewed by the admin team.",
            metadata: { reportId: report._id.toString(), status },
          },
          req.correlationId,
        );
        if (identityClient) {
          try {
            const [reporter] = await identityClient.getUserSummaries(
              [report.reportedBy],
              req.correlationId,
            );
            if (reporter?.email) {
              await notificationClient.publish(
                {
                  eventType: "report.resolved.email",
                  sourceEventId: `report-email:resolved:${report._id}:${status}`,
                  reporterName: reporter.name,
                  reporterEmail: reporter.email,
                  reporterRole: report.reporterRole,
                  complaintType: report.complaintType,
                  status,
                  adminNote: update.adminNote || "",
                },
                req.correlationId,
              );
            }
          } catch (error) {
            process.stderr.write(
              `Report resolution email could not be queued: ${error.message}\n`,
            );
          }
        }
      }
      return res
        .status(200)
        .json({ success: true, data: { report }, message: "Report updated" });
    } catch (error) {
      return next(error);
    }
  };

  const deleteSession = async (req, res, next) => {
    if (!validId(req.params.reportId))
      return res
        .status(400)
        .json({ error: "Invalid report id", code: "INVALID_REPORT_ID" });
    try {
      const report = await reportRepository.findById(req.params.reportId);
      if (!report)
        return res
          .status(404)
          .json({ error: "Report not found", code: "REPORT_NOT_FOUND" });
      const request = report.connectRequest
        ? await connectRequestRepository.findById(report.connectRequest)
        : null;
      if (!request)
        return res
          .status(404)
          .json({ error: "Session not found", code: "SESSION_NOT_FOUND" });
      await connectRequestRepository.deleteRequestById(request._id);
      await reportRepository.updateById(report._id, {
        status: "resolved",
        adminNote: String(
          req.body?.adminNote || "Session deleted by admin.",
        ).trim(),
        resolvedBy: req.body?.resolvedBy || null,
        resolvedAt: new Date(),
      });
      for (const recipient of [request.mentee, request.mentor].filter(
        Boolean,
      )) {
        await notificationClient.publish(
          {
            sourceEventId: `admin-report-session-deleted:${report._id}:${recipient}`,
            recipient: recipient.toString(),
            type: "new_review",
            title: "Session removed by admin",
            message:
              "Your reported session has been removed by the admin team.",
            metadata: {
              reportId: report._id.toString(),
              requestId: request._id.toString(),
            },
          },
          req.correlationId,
        );
      }
      return res
        .status(200)
        .json({ success: true, data: null, message: "Session deleted" });
    } catch (error) {
      return next(error);
    }
  };

  return { getStats, getReports, getReport, updateReport, deleteSession };
};

module.exports = createInternalAdminReportsController;
