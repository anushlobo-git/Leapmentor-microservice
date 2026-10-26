const createAvailabilityBlockerRepository = ({ ConnectRequest, SlotLock }) => {
  const findBookedRequestsByMentor = (mentorId) =>
    ConnectRequest.find(
      { mentor: mentorId, status: { $in: ["pending", "accepted", "ongoing"] } },
      { selectedSlots: 1, selectedSlot: 1 },
    ).lean();

  const findActiveLocksByMentor = (mentorId, excludeUserId) =>
    SlotLock.find({ mentorId, lockedBy: { $ne: excludeUserId }, expiresAt: { $gt: new Date() } }).lean();

  return { findBookedRequestsByMentor, findActiveLocksByMentor };
};

module.exports = createAvailabilityBlockerRepository;
