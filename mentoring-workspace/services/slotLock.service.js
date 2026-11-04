const AppError = require("../utils/AppError");

const LOCK_DURATION_MINUTES = 10;

const toMinutes = (value) => {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
};

const overlaps = (startA, endA, startB, endB) => startA < endB && endA > startB;

const createSlotLockService = ({
  slotLockRepository,
  availabilityBlockerRepository,
  toSlotLockDTO,
}) => {
  const validateInput = ({ mentorId, date, startTime, endTime }) => {
    if (!mentorId || !date || !startTime || !endTime) {
      throw new AppError("mentorId, date, startTime, and endTime are required", 400, "INVALID_SLOT_LOCK");
    }
    if (toMinutes(startTime) >= toMinutes(endTime)) {
      throw new AppError("endTime must be after startTime", 400, "INVALID_SLOT_RANGE");
    }
  };

  const acquireSlotLock = async (menteeId, input) => {
    validateInput(input);
    const { mentorId, date, startTime, endTime } = input;
    const start = toMinutes(startTime);
    const end = toMinutes(endTime);
    const bookings = await availabilityBlockerRepository.findBookedRequestsByMentor(mentorId);
    const booked = bookings.some((request) =>
      (request.selectedSlots || (request.selectedSlot ? [request.selectedSlot] : [])).some((slot) =>
        slot.date === date && overlaps(start, end, toMinutes(slot.startTime), toMinutes(slot.endTime))),
    );
    if (booked) throw new AppError("This slot has already been permanently booked", 409, "SLOT_BOOKED");

    const locks = await slotLockRepository.findActiveLocksByMentorAndDate(mentorId, date);
    const locked = locks.some((lock) =>
      String(lock.lockedBy) !== String(menteeId) && overlaps(start, end, toMinutes(lock.startTime), toMinutes(lock.endTime)),
    );
    if (locked) throw new AppError("This slot is temporarily held by another user", 409, "SLOT_LOCKED");

    const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
    try {
      await slotLockRepository.upsertSlotLock({ mentorId, date, startTime, endTime, lockedBy: menteeId }, expiresAt);
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await slotLockRepository.findLockBySlot({ mentorId, date, startTime, endTime });
      if (existing && new Date(existing.expiresAt) <= new Date()) {
        await slotLockRepository.deleteLockById(existing._id);
        await slotLockRepository.upsertSlotLock({ mentorId, date, startTime, endTime, lockedBy: menteeId }, expiresAt);
      } else {
        throw new AppError("This slot is temporarily held by another user", 409, "SLOT_LOCKED");
      }
    }
    return { expiresAt, lockedFor: LOCK_DURATION_MINUTES };
  };

  const releaseSlotLock = async (menteeId, input) => {
    validateInput(input);
    await slotLockRepository.deleteOneLock({ ...input, lockedBy: menteeId });
  };

  const releaseAllUserLocks = async (menteeId, mentorId) => {
    await slotLockRepository.deleteManyLocks({ lockedBy: menteeId, ...(mentorId ? { mentorId } : {}) });
  };

  const getMentorActiveLocks = async (mentorId, requestingUserId) => ({
    locks: (await slotLockRepository.findActiveLocksExcludingUser(mentorId, requestingUserId)).map(toSlotLockDTO),
  });

  return { acquireSlotLock, releaseSlotLock, releaseAllUserLocks, getMentorActiveLocks };
};

module.exports = createSlotLockService;
