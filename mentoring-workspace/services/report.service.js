const AppError = require("../utils/AppError");

const COMPLAINT_TYPES = new Set([
  "inappropriate_behavior",
  "session_misconduct",
  "fake_credentials",
  "spam_scam",
  "refund",
  "other",
]);

const createReportService = ({
  reportRepository,
  connectRequestRepository,
  cloudinaryClient,
  logger = console,
}) => {
  const createIncidentReport = async ({ userId, body = {}, file, correlationId }) => {
    const { connectRequestId, complaintType, description } = body;
    if (!connectRequestId || !complaintType || !description?.trim()) {
      throw new AppError(
        "connectRequestId, complaintType, and description are required",
        400,
        "INVALID_REPORT_REQUEST",
      );
    }
    const request = await connectRequestRepository.findById(connectRequestId);
    if (!request) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    const mentorId = String(request.mentor?._id ?? request.mentor);
    const menteeId = String(request.mentee?._id ?? request.mentee);
    const reporterId = String(userId);
    const reporterRole = reporterId === mentorId ? "mentor" : reporterId === menteeId ? "mentee" : null;
    if (!reporterRole) throw new AppError("You are not a participant of this session", 403, "NOT_SESSION_PARTICIPANT");
    if (!COMPLAINT_TYPES.has(complaintType)) throw new AppError("Invalid complaintType", 400, "INVALID_REPORT_REQUEST");
    if (description.trim().length < 10) throw new AppError("description must be at least 10 characters", 400, "INVALID_REPORT_REQUEST");
    if (await reportRepository.findReportByConnectAndReporter(connectRequestId, userId)) {
      throw new AppError("You have already submitted a report for this session", 409, "REPORT_EXISTS");
    }

    let asset = { url: "", publicId: "" };
    if (file) {
      try {
        asset = await cloudinaryClient.uploadRawBuffer(file.buffer, {
          folder: `leapmentor/reports/${connectRequestId}`,
          resource_type: "image",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
        });
      } catch (error) {
        throw new AppError("The screenshot could not be uploaded", 502, "UPLOAD_PROVIDER_FAILED");
      }
    }
    try {
      return await reportRepository.create({
        connectRequest: connectRequestId,
        reportedBy: userId,
        reportedUser: reporterRole === "mentor" ? request.mentee : request.mentor,
        reporterRole,
        complaintType,
        description: description.trim(),
        screenshotUrl: asset.url,
        screenshotPublicId: asset.publicId,
      });
    } catch (error) {
      if (asset.publicId) await cloudinaryClient.destroyRawAsset(asset.publicId).catch((cleanupError) => logger.warn?.("Report asset cleanup failed", cleanupError));
      throw error;
    }
  };

  const getMySessionReport = async (connectRequestId, userId) => {
    const request = await connectRequestRepository.findById(connectRequestId);
    if (!request) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    const participantIds = [request.mentor, request.mentee].map((value) => String(value?._id ?? value));
    if (!participantIds.includes(String(userId))) throw new AppError("You are not a participant of this session", 403, "NOT_SESSION_PARTICIPANT");
    return { report: await reportRepository.findReportByConnectAndReporter(connectRequestId, userId) };
  };

  return { createIncidentReport, getMySessionReport };
};

module.exports = createReportService;
