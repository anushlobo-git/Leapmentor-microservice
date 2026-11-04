const test = require("node:test");
const assert = require("node:assert/strict");

const createRepository = require("../../repositories/availabilityBlocker.repository");

test("queries Workspace-owned bookings and locks by mentor", async () => {
  const calls = [];
  const bookedQuery = { lean: async () => [{ selectedSlots: [] }] };
  const lockQuery = { lean: async () => [] };
  const repository = createRepository({
    ConnectRequest: {
      find: (...args) => {
        calls.push(["booked", ...args]);
        return bookedQuery;
      },
    },
    SlotLock: {
      find: (...args) => {
        calls.push(["locked", ...args]);
        return lockQuery;
      },
    },
  });

  await Promise.all([
    repository.findBookedRequestsByMentor("mentor-1"),
    repository.findActiveLocksByMentor("mentor-1", "mentee-1"),
  ]);

  assert.deepEqual(calls[0], [
    "booked",
    { mentor: "mentor-1", status: { $in: ["pending", "accepted", "ongoing"] } },
    { selectedSlots: 1, selectedSlot: 1 },
  ]);
  assert.deepEqual(calls[1][0], "locked");
  assert.deepEqual(calls[1][1].mentorId, "mentor-1");
  assert.deepEqual(calls[1][1].lockedBy, { $ne: "mentee-1" });
  assert.ok(calls[1][1].expiresAt.$gt instanceof Date);
});
