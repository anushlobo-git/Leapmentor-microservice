const createSlotLockRepository = (SlotLock) => {
  const activeFilter = (mentorId, date) => ({
    mentorId,
    ...(date ? { date } : {}),
    expiresAt: { $gt: new Date() },
  });

  const findActiveLocksByMentorAndDate = (mentorId, date) =>
    SlotLock.find(activeFilter(mentorId, date)).lean();

  const upsertSlotLock = (data, expiresAt) =>
    SlotLock.findOneAndUpdate(
      { mentorId: data.mentorId, date: data.date, startTime: data.startTime, endTime: data.endTime },
      { $set: { ...data, expiresAt } },
      { upsert: true, new: true, runValidators: true },
    );

  const findLockBySlot = (data) =>
    SlotLock.findOne({ mentorId: data.mentorId, date: data.date, startTime: data.startTime, endTime: data.endTime });

  const deleteLockById = (id) => SlotLock.deleteOne({ _id: id });

  const deleteOneLock = (data) => SlotLock.deleteOne(data);

  const deleteManyLocks = (filter) => SlotLock.deleteMany(filter);

  const findActiveLocksExcludingUser = (mentorId, lockedBy) =>
    SlotLock.find({ ...activeFilter(mentorId), lockedBy: { $ne: lockedBy } }).lean();

  return {
    findActiveLocksByMentorAndDate,
    upsertSlotLock,
    findLockBySlot,
    deleteLockById,
    deleteOneLock,
    deleteManyLocks,
    findActiveLocksExcludingUser,
  };
};

module.exports = createSlotLockRepository;
