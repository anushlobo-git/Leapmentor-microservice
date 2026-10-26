const test = require("node:test");
const assert = require("node:assert/strict");

const createSlotLockService = require("../../services/slotLock.service");

const createService = ({ locks = [], bookings = [] } = {}) => {
  const repository = {
    findActiveLocksByMentorAndDate: async () => locks,
    upsertSlotLock: async (data, expiresAt) => {
      locks.push({ ...data, expiresAt });
    },
    findLockBySlot: async () => null,
    deleteLockById: async () => undefined,
    deleteOneLock: async (filter) => {
      for (let index = locks.length - 1; index >= 0; index -= 1) {
        if (Object.entries(filter).every(([key, value]) => String(locks[index][key]) === String(value))) locks.splice(index, 1);
      }
    },
    deleteManyLocks: async () => {
      locks.length = 0;
    },
    findActiveLocksExcludingUser: async () => locks,
  };
  const blockerRepository = {
    findBookedRequestsByMentor: async () => bookings,
  };
  const service = createSlotLockService({
    slotLockRepository: repository,
    availabilityBlockerRepository: blockerRepository,
    toSlotLockDTO: (lock) => ({ date: lock.date, startTime: lock.startTime, endTime: lock.endTime }),
  });
  return { service, locks };
};

test("acquires a ten-minute lock when the slot is free", async () => {
  const { service, locks } = createService();

  const result = await service.acquireSlotLock("mentee-1", {
    mentorId: "mentor-1",
    date: "2099-01-01",
    startTime: "10:00",
    endTime: "11:00",
  });

  assert.equal(result.lockedFor, 10);
  assert.equal(locks[0].lockedBy, "mentee-1");
});

test("rejects permanently booked and temporarily locked overlaps", async () => {
  const booked = createService({
    bookings: [{ selectedSlots: [{ date: "2099-01-01", startTime: "10:30", endTime: "11:30" }] }],
  });
  await assert.rejects(booked.service.acquireSlotLock("mentee-1", { mentorId: "mentor-1", date: "2099-01-01", startTime: "10:00", endTime: "11:00" }), { statusCode: 409, code: "SLOT_BOOKED" });

  const locked = createService({
    locks: [{ lockedBy: "other", date: "2099-01-01", startTime: "10:30", endTime: "11:30", expiresAt: new Date(Date.now() + 60_000) }],
  });
  await assert.rejects(locked.service.acquireSlotLock("mentee-1", { mentorId: "mentor-1", date: "2099-01-01", startTime: "10:00", endTime: "11:00" }), { statusCode: 409, code: "SLOT_LOCKED" });
});

test("allows the same mentee to refresh its own lock and releases individual/all locks", async () => {
  const { service, locks } = createService({ locks: [{ mentorId: "mentor-1", lockedBy: "mentee-1", date: "2099-01-01", startTime: "10:00", endTime: "11:00", expiresAt: new Date(Date.now() + 60_000) }] });
  await service.acquireSlotLock("mentee-1", { mentorId: "mentor-1", date: "2099-01-01", startTime: "10:00", endTime: "11:00" });
  await service.releaseSlotLock("mentee-1", { mentorId: "mentor-1", date: "2099-01-01", startTime: "10:00", endTime: "11:00" });
  assert.equal(locks.length, 0);
});
