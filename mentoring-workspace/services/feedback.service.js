// services/mentoring-workspace/services/feedback.service.js
const AppError = require("../utils/AppError");
const { toFeedbackDTO } = require("../utils/feedback.mapper");

const MIN_RATING = 1;
const MAX_RATING = 5;
const ROLE_MENTEE = "mentee";
const ROLE_MENTOR = "mentor";
const STATUS_COMPLETED = "completed";
const DUPLICATE_KEY = 11000;

const defaultLogger = {
  warn: (message, meta = {}) =>
    process.stderr.write(
      `${JSON.stringify({ level: "warn", service: "mentoring-workspace", message, ...meta })}\n`,
    ),
};

/**
 * Peer feedback for completed sessions.
 *
 * Workspace owns Feedback and the session rules. Two collaborators are
 * injected and both degrade instead of failing the request:
 * - `identityClient` supplies participant names (fallback: plain IDs);
 * - `mentorRatingClient.updateAverageRating(mentorId, average, correlationId)`
 *   pushes the recomputed average to Profile & Discovery, which owns
 *   `MentorProfile.avgRating`. The feedback is already saved when it runs, so a
 *   failure is logged and the average is corrected by the next mentee feedback.
 */
const createFeedbackService = ({
  feedbackRepository,
  connectRequestRepository,
  identityClient,
  mentorRatingClient = null,
  logger = defaultLogger,
}) => {
  const _idOf = (value) => String(value?._id ?? value);

  const _deriveRole = (request, userId) => {
    const uid = String(userId);
    if (_idOf(request.mentor) === uid) return ROLE_MENTOR;
    if (_idOf(request.mentee) === uid) return ROLE_MENTEE;
    return null;
  };

  const _hasSlotContext = (slotIndex) =>
    slotIndex !== undefined && slotIndex !== null;

  const _assertCompleted = (request, role, slotIndex) => {
    const notCompleted = () =>
      new AppError(
        "Feedback can only be submitted for completed sessions",
        400,
        "FEEDBACK_SESSION_NOT_COMPLETED",
      );

    if (_hasSlotContext(slotIndex)) {
      const slot = request.selectedSlots?.[slotIndex];
      const marked =
        role === ROLE_MENTEE ? slot?.menteeMarked : slot?.mentorMarked;
      if (!slot || !marked) throw notCompleted();
      return;
    }
    if (request.status !== STATUS_COMPLETED) throw notCompleted();
  };

  const _loadRequest = async (connectRequestId) => {
    const request = await connectRequestRepository.findById(connectRequestId);
    if (!request) {
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    }
    return request;
  };

  const _loadSummaries = async (feedbackList, correlationId) => {
    const ids = feedbackList.flatMap((item) => [item.from, item.to]);
    try {
      return await identityClient.getUserSummaryMap(ids, correlationId);
    } catch (error) {
      logger.warn("Identity lookup failed; returning feedback without names", {
        correlationId,
        reason: error.message,
      });
      return new Map();
    }
  };

  const _syncMentorRating = async (mentorId, correlationId) => {
    if (!mentorRatingClient) {
      logger.warn("Mentor rating sync is not configured; average not updated", {
        correlationId,
        mentorId: String(mentorId),
      });
      return;
    }
    try {
      const received = await feedbackRepository.findAllByTargetUser(mentorId);
      if (received.length === 0) return;
      const total = received.reduce((sum, item) => sum + item.rating, 0);
      const average = Number.parseFloat((total / received.length).toFixed(1));
      await mentorRatingClient.updateAverageRating(
        String(mentorId),
        average,
        correlationId,
      );
    } catch (error) {
      logger.warn("Mentor rating sync failed; feedback was saved", {
        correlationId,
        mentorId: String(mentorId),
        reason: error.message,
      });
    }
  };

  const createFeedback = async ({
    connectRequestId,
    rating,
    comment,
    slotIndex,
    userId,
    correlationId,
  }) => {
    if (!connectRequestId) {
      throw new AppError(
        "connectRequestId is required",
        400,
        "CONNECT_REQUEST_REQUIRED",
      );
    }
    if (
      !Number.isInteger(rating) ||
      rating < MIN_RATING ||
      rating > MAX_RATING
    ) {
      throw new AppError(
        `rating must be a whole number between ${MIN_RATING} and ${MAX_RATING}`,
        400,
        "INVALID_RATING",
      );
    }

    const request = await _loadRequest(connectRequestId);
    const fromRole = _deriveRole(request, userId);
    if (!fromRole) {
      throw new AppError(
        "Not authorized to submit feedback for this session",
        403,
        "NOT_SESSION_PARTICIPANT",
      );
    }
    _assertCompleted(request, fromRole, slotIndex);

    const toUserId =
      fromRole === ROLE_MENTOR ? _idOf(request.mentee) : _idOf(request.mentor);
    const slotFilter = _hasSlotContext(slotIndex) ? { slotIndex } : {};

    const existing = await feedbackRepository.findOne({
      connectRequest: connectRequestId,
      from: userId,
      ...slotFilter,
    });
    const alreadySubmitted = () =>
      new AppError(
        "You have already submitted feedback for this session",
        409,
        "FEEDBACK_EXISTS",
      );
    if (existing) throw alreadySubmitted();

    let feedback;
    try {
      feedback = await feedbackRepository.create({
        connectRequest: connectRequestId,
        from: userId,
        to: toUserId,
        fromRole,
        rating,
        comment: comment?.trim() || "",
        ...slotFilter,
      });
    } catch (error) {
      // Two simultaneous submissions: the unique index decides the loser.
      if (error?.code === DUPLICATE_KEY) throw alreadySubmitted();
      throw error;
    }

    if (fromRole === ROLE_MENTEE) {
      await _syncMentorRating(toUserId, correlationId);
    }

    const summaries = await _loadSummaries([feedback], correlationId);
    return toFeedbackDTO(feedback, summaries);
  };

  const getFeedback = async (connectRequestId, userId, correlationId) => {
    const request = await _loadRequest(connectRequestId);
    if (!_deriveRole(request, userId)) {
      throw new AppError(
        "Not authorized to view this session's feedback",
        403,
        "NOT_SESSION_PARTICIPANT",
      );
    }

    const all =
      await feedbackRepository.findAllByConnectRequest(connectRequestId);
    const uid = String(userId);
    const mine = all.find((item) => _idOf(item.from) === uid) || null;
    const theirs = all.find((item) => _idOf(item.from) !== uid) || null;
    const completed = request.status === STATUS_COMPLETED;

    const visible = [mine, completed ? theirs : null].filter(Boolean);
    const summaries =
      visible.length > 0
        ? await _loadSummaries(visible, correlationId)
        : new Map();

    return {
      myFeedback: toFeedbackDTO(mine, summaries),
      theirFeedback: completed ? toFeedbackDTO(theirs, summaries) : null,
      sessionStatus: request.status,
    };
  };

  return { createFeedback, getFeedback };
};

module.exports = createFeedbackService;
