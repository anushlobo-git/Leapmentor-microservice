const test = require("node:test");
const assert = require("node:assert/strict");

const createSlotLockService = require("../../services/slotLock.service");

const createService = ({ locks = [], bookings = [], repositoryOverrides = {} } = {}) => {
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
    ...repositoryOverrides,
  };
  const blockerRepository = {
    findBookedRequestsByMentor: async () => bookings,
  };
  const service = createSlotLockService({
    slotLockRepository: repository,
    availabilityBlockerRepository: blockerRepository,
    toSlotLockDTO: (lock) => ({ date: lock.date, startTime: lock.startTime, endTime: lock.endTime }),
  });
  return { service, locks, repository };
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

test("validates lock inputs and permits nonoverlapping bookings and locks", async () => {
  const { service } = createService({
    bookings: [{
      selectedSlots: [{ date: "2099-01-01", startTime: "10:00", endTime: "11:00" }],
    }],
    locks: [{
      lockedBy: "other",
      date: "2099-01-01",
      startTime: "10:00",
      endTime: "11:00",
      expiresAt: new Date(Date.now() + 60_000),
    }],
  });
  for (const input of [
    {},
    { mentorId: "mentor-1", date: "2099-01-01", startTime: "11:00", endTime: "10:00" },
  ]) {
    await assert.rejects(service.acquireSlotLock("mentee-1", input));
  }
  const result = await service.acquireSlotLock("mentee-1", {
    mentorId: "mentor-1",
    date: "2099-01-01",
    startTime: "11:00",
    endTime: "12:00",
  });
  assert.equal(result.lockedFor, 10);
});

test("supports legacy booked slots and rejects duplicate lock conflicts", async () => {
  const legacy = createService({
    bookings: [{
      selectedSlot: { date: "2099-01-01", startTime: "10:00", endTime: "11:00" },
    }],
  });
  await assert.rejects(legacy.service.acquireSlotLock("mentee-1", {
    mentorId: "mentor-1",
    date: "2099-01-01",
    startTime: "10:30",
    endTime: "11:30",
  }), { code: "SLOT_BOOKED" });

  const collision = createService({
    repositoryOverrides: {
      upsertSlotLock: async () => {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      },
      findLockBySlot: async () => ({
        _id: "lock-1",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    },
  });
  await assert.rejects(collision.service.acquireSlotLock("mentee-1", {
    mentorId: "mentor-1",
    date: "2099-01-01",
    startTime: "10:00",
    endTime: "11:00",
  }), { code: "SLOT_LOCKED" });
});

test("replaces expired lock collisions and rethrows unrelated repository errors", async () => {
  let upserts = 0;
  const expired = createService({
    repositoryOverrides: {
      upsertSlotLock: async () => {
        upserts += 1;
        if (upserts === 1) {
          const error = new Error("duplicate key");
          error.code = 11000;
          throw error;
        }
      },
      findLockBySlot: async () => ({
        _id: "expired-lock",
        expiresAt: new Date(Date.now() - 60_000),
      }),
    },
  });
  await expired.service.acquireSlotLock("mentee-1", {
    mentorId: "mentor-1",
    date: "2099-01-01",
    startTime: "10:00",
    endTime: "11:00",
  });
  assert.equal(upserts, 2);

  const failure = new Error("database unavailable");
  const failed = createService({
    repositoryOverrides: { upsertSlotLock: async () => { throw failure; } },
  });
  await assert.rejects(failed.service.acquireSlotLock("mentee-1", {
    mentorId: "mentor-1",
    date: "2099-01-01",
    startTime: "10:00",
    endTime: "11:00",
  }), (error) => error === failure);
});

test("releases scoped locks and maps active locks to safe DTOs", async () => {
  const calls = [];
  const lock = {
    mentorId: "mentor-1",
    lockedBy: "mentee-1",
    date: "2099-01-01",
    startTime: "10:00",
    endTime: "11:00",
  };
  const { service } = createService({
    locks: [lock],
    repositoryOverrides: {
      deleteOneLock: async (filter) => calls.push(["one", filter]),
      deleteManyLocks: async (filter) => calls.push(["many", filter]),
      findActiveLocksExcludingUser: async (...args) => {
        calls.push(["active", ...args]);
        return [lock];
      },
    },
  });
  await service.releaseSlotLock("mentee-1", {
    mentorId: "mentor-1",
    date: "2099-01-01",
    startTime: "10:00",
    endTime: "11:00",
  });
  await service.releaseAllUserLocks("mentee-1");
  await service.releaseAllUserLocks("mentee-1", "mentor-1");
  assert.deepEqual(await service.getMentorActiveLocks("mentor-1", "mentee-1"), {
    locks: [{ date: lock.date, startTime: lock.startTime, endTime: lock.endTime }],
  });
  assert.deepEqual(calls[0], ["one", {
    mentorId: "mentor-1",
    date: "2099-01-01",
    startTime: "10:00",
    endTime: "11:00",
    lockedBy: "mentee-1",
  }]);
  assert.deepEqual(calls[1], ["many", { lockedBy: "mentee-1" }]);
  assert.deepEqual(calls[2], ["many", { lockedBy: "mentee-1", mentorId: "mentor-1" }]);
});
