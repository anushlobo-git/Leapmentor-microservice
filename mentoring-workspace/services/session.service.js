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

const createSessionService = ({ sessionRepository, notificationClient = { publish: async () => null } }) => {
  const publish = (event) => notificationClient.publish(event).catch(() => null);
  const assertParticipant = (request, userId) => {
    if (![request.mentor, request.mentee].some((id) => String(id) === String(userId))) {
      throw new AppError("Not authorized", 403, "NOT_SESSION_PARTICIPANT");
    }
  };

  const assertOngoing = (request) => {
    if (request.status !== "ongoing") throw new AppError("Session is not active", 400, "SESSION_NOT_ACTIVE");
  };

  const slotIndex = (request, value) => {
    const index = Number.parseInt(value, 10);
    if (!Number.isInteger(index) || index < 0 || index >= (request.selectedSlots || []).length) {
      throw new AppError("Invalid slot index", 400, "INVALID_SLOT_INDEX");
    }
    return index;
  };

  const stats = (slots) => {
    const activeSlots = slots.filter((slot) => slot.status !== "cancelled");
    const completedSlots = activeSlots.filter((slot) => slot.menteeMarked && slot.mentorMarked).length;
    return { activeSlots, completedSlots, progress: activeSlots.length ? Math.round((completedSlots / activeSlots.length) * 100) : 0 };
  };

  const getSlots = async (connectRequestId, userId) => {
    const request = await sessionRepository.findById(connectRequestId);
    if (!request) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId);
    const result = stats(request.selectedSlots || []);
    return { slots: request.selectedSlots || [], additionalSlots: request.additionalSlots || [], totalSlots: result.activeSlots.length, completedSlots: result.completedSlots, progress: result.progress };
  };

  const setMeetingLink = async ({ connectRequestId, slotIndex: indexValue, meetingLink, userId }) => {
    if (!meetingLink?.trim()) throw new AppError("meetingLink is required", 400, "MEETING_LINK_REQUIRED");
    let url;
    try { url = new URL(meetingLink.trim()); } catch { throw new AppError("Meeting link must be a valid HTTPS URL", 400, "INVALID_MEETING_LINK"); }
    if (url.protocol !== "https:" || !ALLOWED_MEETING_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new AppError("Only trusted meeting platforms are allowed", 400, "INVALID_MEETING_LINK");
    const request = await sessionRepository.findById(connectRequestId);
    if (!request) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId); assertOngoing(request);
    const index = slotIndex(request, indexValue);
    request.selectedSlots[index].meetingLink = meetingLink.trim();
    await sessionRepository.save(request);
    return { slot: request.selectedSlots[index], slotIndex: index };
  };

  const markSlotComplete = async ({ connectRequestId, slotIndex: indexValue, userId }) => {
    const request = await sessionRepository.findById(connectRequestId);
    if (!request) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId); assertOngoing(request);
    const index = slotIndex(request, indexValue);
    const slot = request.selectedSlots[index];
    if (slot.status === "cancelled") throw new AppError("Cannot complete a cancelled slot", 400, "SLOT_CANCELLED");
    const isMentee = String(request.mentee) === String(userId);
    const markField = isMentee ? "menteeMarked" : "mentorMarked";
    if (slot[markField]) throw new AppError("You have already marked this slot complete", 400, "SLOT_ALREADY_MARKED");
    slot[markField] = true;
    const bothMarked = Boolean(slot.menteeMarked && slot.mentorMarked);
    if (bothMarked) slot.completedAt = new Date();
    await sessionRepository.save(request);
    if (bothMarked) {
      await Promise.all([request.mentor, request.mentee].map((recipient) => publish({
        sourceEventId: `workspace.session:${connectRequestId}:slot:${index}:completed:${recipient}`,
        recipient,
        type: "session_completed",
        title: "Session completed",
        message: "A session slot has been marked complete by both participants.",
        metadata: { requestId: connectRequestId, sessionId: connectRequestId, recipient },
      })));
    }
    const result = stats(request.selectedSlots);
    const allComplete = result.activeSlots.length > 0 && result.completedSlots === result.activeSlots.length;
    return { success: true, slot, slotIndex: index, bothMarked, allComplete, completedSlots: result.completedSlots, totalSlots: result.activeSlots.length, progress: result.progress, escrowRelease: null };
  };

  const addSlot = async ({ connectRequestId, date, startTime, endTime, userId }) => {
    if (!date || !startTime || !endTime || toMinutes(startTime) >= toMinutes(endTime)) throw new AppError("Valid date, startTime and endTime are required", 400, "INVALID_SLOT");
    const request = await sessionRepository.findById(connectRequestId);
    if (!request) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId); assertOngoing(request);
    const allSlots = [...(request.selectedSlots || []), ...(request.additionalSlots || [])];
    if (allSlots.some((slot) => slot.status !== "cancelled" && slot.date === date && slot.startTime === startTime && slot.endTime === endTime)) throw new AppError("This slot already exists", 409, "SLOT_EXISTS");
    const slot = { date, startTime, endTime, paymentStatus: "pending", menteeMarked: false, mentorMarked: false };
    request.additionalSlots = request.additionalSlots || [];
    request.additionalSlots.push(slot);
    await sessionRepository.save(request);
    return { slot: request.additionalSlots.at(-1), additionalSlots: request.additionalSlots };
  };

  const cancelSlot = async ({ connectRequestId, slotIndex: indexValue, reason, userId }) => {
    const request = await sessionRepository.findById(connectRequestId);
    if (!request) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId); assertOngoing(request);
    const index = slotIndex(request, indexValue);
    const slot = request.selectedSlots[index];
    if (slot.status === "cancelled") throw new AppError("Slot is already cancelled", 400, "SLOT_CANCELLED");
    slot.status = "cancelled"; slot.cancelledBy = String(request.mentor) === String(userId) ? "mentor" : "mentee"; slot.cancelledAt = new Date(); slot.cancellationReason = String(reason || "").trim();
    await sessionRepository.save(request);
    return { slot, slotIndex: index };
  };

  const rescheduleSlot = async ({ connectRequestId, slotIndex: indexValue, date, startTime, endTime, userId }) => {
    if (!date || !startTime || !endTime || toMinutes(startTime) >= toMinutes(endTime)) throw new AppError("Valid date, startTime and endTime are required", 400, "INVALID_SLOT");
    const request = await sessionRepository.findById(connectRequestId);
    if (!request) throw new AppError("Session not found", 404, "SESSION_NOT_FOUND");
    assertParticipant(request, userId); assertOngoing(request);
    const index = slotIndex(request, indexValue);
    const current = request.selectedSlots[index];
    if (current.status === "cancelled") throw new AppError("Cannot reschedule a cancelled slot", 400, "SLOT_CANCELLED");
    if (request.selectedSlots.some((slot, slotIndexValue) => slotIndexValue !== index && slot.status !== "cancelled" && slot.date === date && slot.startTime === startTime && slot.endTime === endTime)) throw new AppError("This slot already exists", 409, "SLOT_EXISTS");
    Object.assign(current, { date, startTime, endTime, isRescheduled: true, rescheduledFromIndex: index });
    await sessionRepository.save(request);
    return { slot: current, slotIndex: index };
  };

  return { getSlots, setMeetingLink, markSlotComplete, addSlot, cancelSlot, rescheduleSlot };
};

module.exports = createSessionService;
