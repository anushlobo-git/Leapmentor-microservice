// services/mentoring-workspace/services/goal.service.js
const AppError = require("../utils/AppError");
const { toGoalDTO, toMilestoneDTO } = require("../utils/goal.mapper");

const STATUS_ONGOING = "ongoing";
const VALID_GOAL_STATUSES = new Set(["active", "completed", "abandoned"]);

const EVENT_GOAL_CREATED = "goal_created";
const EVENT_GOAL_UPDATED = "goal_updated";
const EVENT_MILESTONE_ADDED = "milestone_added";
const EVENT_MILESTONE_UPDATED = "milestone_updated";
const EVENT_MILESTONE_DELETED = "milestone_deleted";

/**
 * Goal & Milestone business service for Mentoring Workspace.
 *
 * socketHandler is the injected realtime publisher. The service calls
 * socketHandler.emitToRoom(roomId, event, data) when available so that
 * live clients see goal/milestone changes immediately. If the publisher is
 * absent (tests, non-socket environments) the calls are silently skipped.
 */
const createGoalService = ({
  connectRequestRepository,
  goalRepository,
  milestoneRepository,
  socketHandler = null,
}) => {
  // ── helpers ──────────────────────────────────────────────────────────────

  const _assertParticipant = (connectRequest, userId) => {
    const mentorId = connectRequest.mentor?._id ?? connectRequest.mentor;
    const menteeId = connectRequest.mentee?._id ?? connectRequest.mentee;
    if (
      userId.toString() !== mentorId.toString() &&
      userId.toString() !== menteeId.toString()
    ) {
      throw new AppError("Not authorized", 403, "NOT_PARTICIPANT");
    }
  };

  const _emitToRoom = (connectRequestId, event, data) => {
    try {
      socketHandler?.emitToRoom?.(connectRequestId.toString(), event, data);
    } catch (_) {
      // socket errors must never propagate to the HTTP response
    }
  };

  // ── Goal operations ───────────────────────────────────────────────────────

  const createGoal = async ({
    connectRequestId,
    title,
    description,
    startDate,
    endDate,
    userId,
  }) => {
    if (!connectRequestId) throw new AppError("connectRequestId is required", 400);
    if (!title?.trim()) throw new AppError("title is required", 400);

    const session = await connectRequestRepository.findById(connectRequestId);
    if (!session) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    if (session.status !== STATUS_ONGOING) {
      throw new AppError("Goals can only be set for ongoing sessions", 400, "SESSION_NOT_ONGOING");
    }

    _assertParticipant(session, userId);

    const existing = await goalRepository.findOneByConnectRequestLean(connectRequestId);
    if (existing) throw new AppError("A goal already exists for this session", 409, "GOAL_EXISTS");

    const mentorId = session.mentor?._id ?? session.mentor;
    const menteeId = session.mentee?._id ?? session.mentee;

    const goal = await goalRepository.create({
      connectRequest: connectRequestId,
      mentor: mentorId,
      mentee: menteeId,
      title: title.trim(),
      description: description?.trim() || "",
      startDate: startDate || null,
      endDate: endDate || null,
      createdBy: userId,
    });

    const dto = toGoalDTO(goal);
    _emitToRoom(connectRequestId, EVENT_GOAL_CREATED, { goal: dto });
    return dto;
  };

  const getGoalByConnection = async (connectRequestId, userId) => {
    const session = await connectRequestRepository.findById(connectRequestId);
    if (!session) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    _assertParticipant(session, userId);

    const goal = await goalRepository.findOneByConnectRequestLean(connectRequestId);
    if (!goal) return { goal: null, milestones: [] };

    const milestones = await milestoneRepository.findAllByGoalSorted(goal._id);
    return {
      goal: toGoalDTO(goal),
      milestones: milestones.map(toMilestoneDTO),
    };
  };

  const updateGoal = async ({
    goalId,
    title,
    description,
    startDate,
    endDate,
    status,
    userId,
  }) => {
    const goal = await goalRepository.findById(goalId);
    if (!goal) throw new AppError("Goal not found", 404, "GOAL_NOT_FOUND");

    const session = await connectRequestRepository.findById(goal.connectRequest);
    if (!session) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    _assertParticipant(session, userId);

    if (title !== undefined) {
      if (!title.trim()) throw new AppError("title cannot be empty", 400);
      goal.title = title.trim();
    }
    if (description !== undefined) goal.description = description.trim();
    if (startDate !== undefined) goal.startDate = startDate || null;
    if (endDate !== undefined) goal.endDate = endDate || null;
    if (status !== undefined) {
      if (!VALID_GOAL_STATUSES.has(status)) throw new AppError("Invalid status", 400, "INVALID_STATUS");
      goal.status = status;
    }

    await goalRepository.save(goal);

    const dto = toGoalDTO(goal);
    _emitToRoom(goal.connectRequest, EVENT_GOAL_UPDATED, { goal: dto });
    return dto;
  };

  // ── Milestone operations ───────────────────────────────────────────────────

  const createMilestone = async ({
    goalId,
    title,
    description,
    dueDate,
    userId,
  }) => {
    const goal = await goalRepository.findById(goalId);
    if (!goal) throw new AppError("Goal not found", 404, "GOAL_NOT_FOUND");

    const session = await connectRequestRepository.findById(goal.connectRequest);
    if (!session) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    _assertParticipant(session, userId);

    if (!title?.trim()) throw new AppError("title is required", 400);

    const lastMilestone = await milestoneRepository.findLastMilestone(goal._id);
    const order = lastMilestone ? lastMilestone.order + 1 : 0;

    const milestone = await milestoneRepository.create({
      goal: goal._id,
      connectRequest: goal.connectRequest,
      title: title.trim(),
      description: description?.trim() || "",
      dueDate: dueDate || null,
      order,
    });

    const dto = toMilestoneDTO(milestone);
    _emitToRoom(goal.connectRequest, EVENT_MILESTONE_ADDED, { milestone: dto });
    return dto;
  };

  const updateMilestone = async ({
    milestoneId,
    title,
    description,
    isCompleted,
    userId,
  }) => {
    const milestone = await milestoneRepository.findById(milestoneId);
    if (!milestone) throw new AppError("Milestone not found", 404, "MILESTONE_NOT_FOUND");

    const session = await connectRequestRepository.findById(milestone.connectRequest);
    if (!session) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    _assertParticipant(session, userId);

    if (title !== undefined) {
      if (!title.trim()) throw new AppError("title cannot be empty", 400);
      milestone.title = title.trim();
    }
    if (description !== undefined) milestone.description = description.trim();
    if (isCompleted !== undefined) {
      milestone.isCompleted = isCompleted;
      milestone.completedAt = isCompleted ? new Date() : null;
      milestone.completedBy = isCompleted ? userId : null;
    }

    await milestoneRepository.save(milestone);

    const dto = toMilestoneDTO(milestone);
    _emitToRoom(milestone.connectRequest, EVENT_MILESTONE_UPDATED, { milestone: dto });
    return dto;
  };

  const deleteMilestone = async (milestoneId, userId) => {
    const milestone = await milestoneRepository.findById(milestoneId);
    if (!milestone) throw new AppError("Milestone not found", 404, "MILESTONE_NOT_FOUND");

    const session = await connectRequestRepository.findById(milestone.connectRequest);
    if (!session) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    _assertParticipant(session, userId);

    const connectRequestId = milestone.connectRequest;
    await milestoneRepository.deleteById(milestoneId);

    _emitToRoom(connectRequestId, EVENT_MILESTONE_DELETED, { milestoneId });
    return milestoneId;
  };

  return {
    createGoal,
    getGoalByConnection,
    updateGoal,
    createMilestone,
    updateMilestone,
    deleteMilestone,
  };
};

module.exports = createGoalService;
