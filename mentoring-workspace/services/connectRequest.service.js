const AppError = require("../utils/AppError");

const safeSlot = (slot) => ({
  day: slot.day || "",
  date: slot.date,
  startTime: slot.startTime,
  endTime: slot.endTime,
});

const toDTO = (request) => ({
  ...request,
  _id: request._id?.toString?.() || request._id,
  mentee: request.mentee?.toString?.() || request.mentee,
  mentor: request.mentor?.toString?.() || request.mentor,
});

const createConnectRequestService = ({ connectRequestRepository, notificationClient = { publish: async () => null } }) => {
  const publish = (event) => notificationClient.publish(event).catch(() => null);
  const validateSlots = (selectedSlots) => {
    if (!Array.isArray(selectedSlots) || selectedSlots.length < 1) {
      throw new AppError("At least one slot must be selected", 400, "INVALID_SLOTS");
    }
    if (selectedSlots.length > 5) {
      throw new AppError("Maximum 5 slots can be proposed", 400, "INVALID_SLOTS");
    }
    for (const slot of selectedSlots) {
      if (!slot.date || !slot.startTime || !slot.endTime) {
        throw new AppError("Each slot must have date, startTime and endTime", 400, "INVALID_SLOT");
      }
    }
  };

  const sendConnectRequest = async (menteeId, body) => {
    const { mentorId, message, selectedSlots, sessionRate, sessionCount } = body || {};
    if (!mentorId) throw new AppError("mentorId is required", 400, "MENTOR_REQUIRED");
    if (String(mentorId) === String(menteeId)) throw new AppError("You cannot send a request to yourself", 400, "SELF_REQUEST");
    validateSlots(selectedSlots);
    if (sessionRate !== undefined && (!Number.isFinite(Number(sessionRate)) || Number(sessionRate) < 1)) {
      throw new AppError("sessionRate must be at least 1", 400, "INVALID_SESSION_RATE");
    }
    const existing = await connectRequestRepository.findPendingRequest(menteeId, mentorId);
    if (existing) throw new AppError("You already have a pending request with this mentor", 409, "PENDING_REQUEST_EXISTS");
    for (const slot of selectedSlots) {
      if (await connectRequestRepository.findSlotConflict(mentorId, slot)) {
        throw new AppError(`Slot ${slot.date} ${slot.startTime}–${slot.endTime} is already taken`, 409, "SLOT_TAKEN");
      }
    }
    const count = Number(sessionCount || selectedSlots.length);
    const rate = sessionRate === undefined ? null : Number(sessionRate);
    const request = await connectRequestRepository.createRequest({
      mentee: menteeId,
      mentor: mentorId,
      message: String(message || "").trim(),
      selectedSlots: selectedSlots.map(safeSlot),
      sessionRate: rate,
      sessionCount: count,
      totalAmount: rate == null ? null : rate * count,
      status: "pending",
      paymentStatus: "unpaid",
      requestedAt: new Date(),
    });
    await publish({
      sourceEventId: `workspace.connect-request:${request._id}:received`,
      recipient: mentorId,
      type: "connect_request_received",
      title: "New mentoring request",
      message: "You received a new mentoring request.",
      metadata: { requestId: request._id, mentorId, menteeId },
    });
    return toDTO(request);
  };

  const getMyRequests = async (menteeId) =>
    (await connectRequestRepository.findMyRequests(menteeId)).map(toDTO);

  const getIncomingRequests = async (mentorId, status) =>
    (await connectRequestRepository.findIncomingRequests(mentorId, status)).map(toDTO);

  const respondToRequest = async (requestId, mentorId, body) => {
    const status = body?.status;
    if (!['accepted', 'rejected'].includes(status)) throw new AppError("Status must be 'accepted' or 'rejected'", 400, "INVALID_REQUEST_STATUS");
    if (status === "accepted") {
      validateSlots([body.confirmedSlot]);
      const conflict = await connectRequestRepository.findSlotConflict(mentorId, body.confirmedSlot);
      if (conflict && String(conflict._id) !== String(requestId)) throw new AppError("This slot has already been booked", 409, "SLOT_TAKEN");
    }
    const request = await connectRequestRepository.updatePendingResponse(requestId, mentorId, {
      status,
      ...(status === "accepted" ? { confirmedSlot: safeSlot(body.confirmedSlot) } : {}),
      respondedAt: new Date(),
      ...(status === "accepted" && { sessionCount: body.sessionCount || undefined }),
    });
    if (!request) throw new AppError("Request not found or already responded", 404, "REQUEST_NOT_FOUND");
    await publish({
      sourceEventId: `workspace.connect-request:${requestId}:${status}`,
      recipient: request.mentee,
      type: status === "accepted" ? "connect_request_accepted" : "connect_request_declined",
      title: status === "accepted" ? "Mentoring request accepted" : "Mentoring request declined",
      message: status === "accepted" ? "Your mentoring request was accepted." : "Your mentoring request was declined.",
      metadata: { requestId, mentorId, menteeId: request.mentee },
    });
    return toDTO(request);
  };

  const cancelRequest = async (requestId, menteeId) => {
    const request = await connectRequestRepository.findById(requestId);
    if (!request) throw new AppError("Request not found", 404, "REQUEST_NOT_FOUND");
    if (String(request.mentee) !== String(menteeId)) throw new AppError("Not authorized to cancel this request", 403, "NOT_REQUEST_OWNER");
    if (["ongoing", "completed"].includes(request.status)) throw new AppError("Cannot cancel an active or completed session", 400, "REQUEST_NOT_CANCELLABLE");
    await connectRequestRepository.deleteRequest(requestId, menteeId);
  };

  const getOngoingConnects = async (userId) =>
    (await connectRequestRepository.findOngoingConnects(userId)).map(toDTO);

  const getConnectDetail = async (requestId, userId) => {
    const request = await connectRequestRepository.findById(requestId);
    if (!request) throw new AppError("Session not found", 404, "REQUEST_NOT_FOUND");
    if (![request.mentee, request.mentor].some((id) => String(id) === String(userId))) {
      throw new AppError("Not authorized to view this session", 403, "NOT_REQUEST_PARTICIPANT");
    }
    return { ...toDTO(request), viewerRole: String(request.mentee) === String(userId) ? "mentee" : "mentor" };
  };

  return { sendConnectRequest, getMyRequests, getIncomingRequests, respondToRequest, cancelRequest, getOngoingConnects, getConnectDetail };
};

module.exports = createConnectRequestService;
