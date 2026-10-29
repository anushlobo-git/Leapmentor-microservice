const createAvailabilityBlockerRepository = ({ ConnectRequest, SlotLock }) => {
  const findRequestSlotsById = (requestId, mentorId) =>
    ConnectRequest.findOne({ _id: requestId, mentor: mentorId })
      .select("selectedSlots selectedSlot additionalSlots")
      .lean();

  const findBookedRequestsByMentor = (mentorId) =>
    ConnectRequest.find(
      { mentor: mentorId, status: { $in: ["pending", "accepted", "ongoing"] } },
      { selectedSlots: 1, selectedSlot: 1 },
    ).lean();

  const findActiveLocksByMentor = (mentorId, excludeUserId) =>
    SlotLock.find({
      mentorId,
      lockedBy: { $ne: excludeUserId },
      expiresAt: { $gt: new Date() },
    }).lean();

  return {
    findBookedRequestsByMentor,
    findActiveLocksByMentor,
    findRequestSlotsById,
  };
};

module.exports = createAvailabilityBlockerRepository;
