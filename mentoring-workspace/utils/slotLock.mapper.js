const toSlotLockDTO = (lock) => ({
  _id: lock._id?.toString?.() || lock._id,
  mentorId: lock.mentorId?.toString?.() || lock.mentorId,
  lockedBy: lock.lockedBy?.toString?.() || lock.lockedBy,
  date: lock.date,
  startTime: lock.startTime,
  endTime: lock.endTime,
  expiresAt: lock.expiresAt,
});

module.exports = { toSlotLockDTO };
