const AppError = require("../utils/AppError");

const ALLOWED_MEETING_HOSTS = [
  "meet.google.com",
  "zoom.us",
  "teams.microsoft.com",
  "whereby.com",
  "around.co",
  "meet.jit.si",
  "webex.com",
];

const toMinutes = (value) => {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
};

const createSessionService = ({
  sessionRepository,
  notificationClient = { publish: async () => null },
  profileClient = null,
  paymentsClient = null,
  identityClient = null,
  realtimePublisher = null,
  logger = console,
}) => {
  const publish = (event) =>
    notificationClient.publish(event).catch(() => null);
  const queueSessionEmail = async (request, event, correlationId) => {
    if (!identityClient || !notificationClient?.publish) return;
    try {
      const users = await identityClient.getUserSummaries(
        [request.mentor, request.mentee],
        correlationId,
      );
      const usersById = new Map(
        (users || []).map((user) => [String(user._id), user]),
      );
      const mentor = usersById.get(String(request.mentor));
      const mentee = usersById.get(String(request.mentee));
      if (!mentor?.email || !mentee?.email) return;
      await publish({
        ...event,
        mentorEmail: mentor.email,
        mentorName: mentor.name,
        menteeEmail: mentee.email,
        menteeName: mentee.name,
      });
    } catch (error) {
      logger.warn?.("Session email could not be queued", {
        requestId: String(request._id),
        eventType: event.eventType,
        error: error.message,
      });
    }
  };
  const assertParticipant = (request, userId) => {
    if (
      ![request.mentor, request.mentee].some(
        (id) => String(id) === String(userId),
      )
    ) {
      throw new AppError("Not authorized", 403, "NOT_SESSION_PARTICIPANT");
    }
  };

  const assertOngoing = (request) => {
    if (request.status !== "ongoing")
      throw new AppError("Session is not active", 400, "SESSION_NOT_ACTIVE");
  };

  const slotIndex = (request, value) => {
    const index = Number.parseInt(value, 10);
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= (request.selectedSlots || []).length
    ) {
      throw new AppError("Invalid slot index", 400, "INVALID_SLOT_INDEX");
    }
    return index;
  };

  const stats = (slots) => {
    const activeSlots = slots.filter((slot) => slot.status !== "cancelled");
    const completedSlots = activeSlots.filter(
      (slot) => slot.menteeMarked && slot.mentorMarked,
    ).length;
    return {
      activeSlots,
      completedSlots,
      progress: activeSlots.length
        ? Math.round((completedSlots / activeSlots.length) * 100)
        : 0,
    };
  };
  const publishSlotUpdate = (request, payload) => {
    for (const recipient of [request.mentor, request.mentee]) {
      realtimePublisher?.publishToUser?.(
        recipient,
        "session_slots_updated",
        payload,
      );
    }
  };
  const attemptEscrowRelease = async (request, correlationId) => {
    if (!paymentsClient) return null;
    try {
      const result = await paymentsClient.releaseEscrow(
        request._id,
        request.mentee,
        correlationId,
      );
      await sessionRepository.updateEscrowReleaseStatus?.(
        request._id,
        "released",
        "",
      );
      return result;
    } catch (error) {
      await sessionRepository
        .updateEscrowReleaseStatus?.(request._id, "pending", error.message)
        .catch?.(() => null);
      logger.warn?.("Escrow release failed after session completion", {
        connectRequestId: String(request._id),
        reason: error.message,
      });
      return null;
    }
  };

  const getSlots = async (connectRequestId, userId) => {
    const request = await sessionRepository.findById(connectRequestId);
    if (!request)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId);
    const result = stats(request.selectedSlots || []);
    return {
      slots: request.selectedSlots || [],
      additionalSlots: request.additionalSlots || [],
      totalSlots: result.activeSlots.length,
      completedSlots: result.completedSlots,
      progress: result.progress,
    };
  };

  const setMeetingLink = async ({
    connectRequestId,
    slotIndex: indexValue,
    meetingLink,
    userId,
  }) => {
    if (!meetingLink?.trim())
      throw new AppError(
        "meetingLink is required",
        400,
        "MEETING_LINK_REQUIRED",
      );
    let url;
    try {
      url = new URL(meetingLink.trim());
    } catch {
      throw new AppError(
        "Meeting link must be a valid HTTPS URL",
        400,
        "INVALID_MEETING_LINK",
      );
    }
    if (
      url.protocol !== "https:" ||
      !ALLOWED_MEETING_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    )
      throw new AppError(
        "Only trusted meeting platforms are allowed",
        400,
        "INVALID_MEETING_LINK",
      );
    const request = await sessionRepository.findById(connectRequestId);
    if (!request)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId);
    assertOngoing(request);
    const index = slotIndex(request, indexValue);
    request.selectedSlots[index].meetingLink = meetingLink.trim();
    await sessionRepository.save(request);
    publishSlotUpdate(request, {
      requestId: connectRequestId,
      slotIndex: index,
      slot: request.selectedSlots[index],
    });
    return { slot: request.selectedSlots[index], slotIndex: index };
  };

  const markSlotComplete = async ({
    connectRequestId,
    slotIndex: indexValue,
    userId,
    correlationId,
  }) => {
    const request = await sessionRepository.findById(connectRequestId);
    if (!request)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId);
    assertOngoing(request);
    const index = slotIndex(request, indexValue);
    const slot = request.selectedSlots[index];
    if (slot.status === "cancelled")
      throw new AppError(
        "Cannot complete a cancelled slot",
        400,
        "SLOT_CANCELLED",
      );
    const isMentee = String(request.mentee) === String(userId);
    const markField = isMentee ? "menteeMarked" : "mentorMarked";
    if (slot[markField])
      throw new AppError(
        "You have already marked this slot complete",
        400,
        "SLOT_ALREADY_MARKED",
      );
    slot[markField] = true;
    const bothMarked = Boolean(slot.menteeMarked && slot.mentorMarked);
    if (bothMarked) slot.completedAt = new Date();
    const result = stats(request.selectedSlots || []);
    const allComplete =
      result.activeSlots.length > 0 &&
      result.completedSlots === result.activeSlots.length;
    if (allComplete) {
      request.escrowReleaseStatus = "pending";
      request.escrowReleaseError = "";
    }
    await sessionRepository.save(request);
    publishSlotUpdate(request, {
      requestId: connectRequestId,
      slotIndex: index,
      slot,
      bothMarked,
    });
    if (bothMarked) {
      await Promise.all(
        [request.mentor, request.mentee].map((recipient) =>
          publish({
            sourceEventId: `workspace.session:${connectRequestId}:slot:${index}:completed:${recipient}`,
            recipient,
            type: "session_completed",
            title: "Session completed",
            message:
              "A session slot has been marked complete by both participants.",
            metadata: {
              requestId: connectRequestId,
              sessionId: connectRequestId,
              recipient,
            },
          }),
        ),
      );
    }
    let escrowRelease = null;
    if (allComplete)
      escrowRelease = await attemptEscrowRelease(request, correlationId);
    return {
      success: true,
      slot,
      slotIndex: index,
      bothMarked,
      allComplete,
      completedSlots: result.completedSlots,
      totalSlots: result.activeSlots.length,
      progress: result.progress,
      escrowRelease,
    };
  };

  const addSlot = async ({
    connectRequestId,
    date,
    startTime,
    endTime,
    userId,
    correlationId,
  }) => {
    if (
      !date ||
      !startTime ||
      !endTime ||
      toMinutes(startTime) >= toMinutes(endTime)
    )
      throw new AppError(
        "Valid date, startTime and endTime are required",
        400,
        "INVALID_SLOT",
      );
    const request = await sessionRepository.findById(connectRequestId);
    if (!request)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId);
    assertOngoing(request);
    const allSlots = [
      ...(request.selectedSlots || []),
      ...(request.additionalSlots || []),
    ];
    if (
      allSlots.some(
        (slot) =>
          slot.status !== "cancelled" &&
          slot.date === date &&
          slot.startTime === startTime &&
          slot.endTime === endTime,
      )
    )
      throw new AppError("This slot already exists", 409, "SLOT_EXISTS");
    const slot = {
      date,
      startTime,
      endTime,
      paymentStatus: "pending",
      menteeMarked: false,
      mentorMarked: false,
    };
    request.additionalSlots = request.additionalSlots || [];
    request.additionalSlots.push(slot);
    await sessionRepository.save(request);
    await queueSessionEmail(
      request,
      {
        eventType: "session.additional-slot.email",
        sourceEventId: `workspace.session:${connectRequestId}:additional:${date}:${startTime}:email`,
        connectRequestId,
        slot,
      },
      correlationId,
    );
    publishSlotUpdate(request, {
      requestId: connectRequestId,
      additionalSlot: slot,
      type: "added",
    });
    return {
      slot: request.additionalSlots.at(-1),
      additionalSlots: request.additionalSlots,
    };
  };

  const cancelSlot = async ({
    connectRequestId,
    slotIndex: indexValue,
    reason,
    userId,
    correlationId,
  }) => {
    const request = await sessionRepository.findById(connectRequestId);
    if (!request)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId);
    assertOngoing(request);
    const index = slotIndex(request, indexValue);
    const slot = request.selectedSlots[index];
    if (slot.status === "cancelled")
      throw new AppError("Slot is already cancelled", 400, "SLOT_CANCELLED");
    slot.status = "cancelled";
    slot.cancelledBy =
      String(request.mentor) === String(userId) ? "mentor" : "mentee";
    slot.cancelledAt = new Date();
    slot.cancellationReason = String(reason || "").trim();
    await sessionRepository.save(request);
    await queueSessionEmail(
      request,
      {
        eventType: "session.slot-cancelled.email",
        sourceEventId: `workspace.session:${connectRequestId}:slot:${index}:cancelled:email`,
        connectRequestId,
        slot,
        cancelledBy: slot.cancelledBy,
        reason: slot.cancellationReason,
      },
      correlationId,
    );
    publishSlotUpdate(request, {
      requestId: connectRequestId,
      slotIndex: index,
      slot,
      type: "cancelled",
    });
    return { slot, slotIndex: index };
  };

  const rescheduleSlot = async ({
    connectRequestId,
    slotIndex: indexValue,
    date,
    startTime,
    endTime,
    userId,
    correlationId,
  }) => {
    if (
      !date ||
      !startTime ||
      !endTime ||
      toMinutes(startTime) >= toMinutes(endTime)
    )
      throw new AppError(
        "Valid date, startTime and endTime are required",
        400,
        "INVALID_SLOT",
      );
    const request = await sessionRepository.findById(connectRequestId);
    if (!request)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId);
    assertOngoing(request);
    const index = slotIndex(request, indexValue);
    const current = request.selectedSlots[index];
    const oldSlot = {
      date: current.date,
      startTime: current.startTime,
      endTime: current.endTime,
    };
    if (current.status === "cancelled")
      throw new AppError(
        "Cannot reschedule a cancelled slot",
        400,
        "SLOT_CANCELLED",
      );
    if (
      request.selectedSlots.some(
        (slot, slotIndexValue) =>
          slotIndexValue !== index &&
          slot.status !== "cancelled" &&
          slot.date === date &&
          slot.startTime === startTime &&
          slot.endTime === endTime,
      )
    )
      throw new AppError("This slot already exists", 409, "SLOT_EXISTS");
    Object.assign(current, {
      date,
      startTime,
      endTime,
      isRescheduled: true,
      rescheduledFromIndex: index,
    });
    await sessionRepository.save(request);
    await queueSessionEmail(
      request,
      {
        eventType: "session.slot-rescheduled.email",
        sourceEventId: `workspace.session:${connectRequestId}:slot:${index}:rescheduled:${date}:${startTime}:email`,
        connectRequestId,
        oldSlot,
        newSlot: current,
      },
      correlationId,
    );
    publishSlotUpdate(request, {
      requestId: connectRequestId,
      slotIndex: index,
      slot: current,
      type: "rescheduled",
    });
    return { slot: current, slotIndex: index };
  };

  const getMentorAvailability = async (
    connectRequestId,
    duration,
    userId,
    correlationId,
  ) => {
    const request = await sessionRepository.findById(connectRequestId);
    if (!request)
      throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId);
    if (!profileClient)
      return {
        slots: [],
        timezone: "Asia/Kolkata",
        sessionDurations: [30, 60],
      };
    return profileClient.getMentorAvailability(
      request.mentor,
      duration,
      userId,
      correlationId,
      connectRequestId,
    );
  };

  const retryPendingEscrowReleases = async (correlationId) => {
    if (!paymentsClient || !sessionRepository.findPendingEscrowReleases) {
      return { attempted: 0, released: 0 };
    }
    const pending = await sessionRepository.findPendingEscrowReleases(50);
    let released = 0;
    for (const request of pending) {
      if (await attemptEscrowRelease(request, correlationId)) released += 1;
    }
    return { attempted: pending.length, released };
  };

  return {
    getSlots,
    setMeetingLink,
    markSlotComplete,
    addSlot,
    cancelSlot,
    rescheduleSlot,
    getMentorAvailability,
    retryPendingEscrowReleases,
  };
};

module.exports = createSessionService;
