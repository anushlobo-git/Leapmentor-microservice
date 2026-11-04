const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/slotLock.controller");

const invoke = async (handler, req) => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let error;
  await handler(req, res, (value) => { error = value; });
  return { res, error };
};

test("slot lock controller delegates lock operations and returns the expected response contract", async () => {
  const calls = [];
  const controller = createController({
    slotLockService: {
      acquireSlotLock: async (...args) => { calls.push(["acquire", ...args]); return { locked: true }; },
      releaseSlotLock: async (...args) => calls.push(["release", ...args]),
      releaseAllUserLocks: async (...args) => calls.push(["releaseAll", ...args]),
      getMentorActiveLocks: async (...args) => { calls.push(["active", ...args]); return []; },
    },
  });
  const req = {
    user: { _id: "user-1" },
    body: { mentorId: "mentor-1", date: "2026-01-01" },
    params: { mentorId: "mentor-2" },
  };
  for (const [handler, expected] of [
    ["lock", "Slot locked successfully"],
    ["unlock", "Slot unlocked successfully"],
    ["unlockAll", "All locks released successfully"],
    ["active", "Active slot locks retrieved"],
  ]) {
    const result = await invoke(controller[handler], req);
    assert.equal(result.error, undefined);
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.res.body.message, expected);
  }
  assert.deepEqual(calls, [
    ["acquire", "user-1", req.body],
    ["release", "user-1", req.body],
    ["releaseAll", "user-1", "mentor-1"],
    ["active", "mentor-2", "user-1"],
  ]);
});

test("slot lock controller forwards service errors from each operation", async () => {
  const failure = new Error("lock service unavailable");
  const controller = createController({
    slotLockService: Object.fromEntries(
      ["acquireSlotLock", "releaseSlotLock", "releaseAllUserLocks", "getMentorActiveLocks"]
        .map((method) => [method, async () => { throw failure; }]),
    ),
  });
  const req = { user: { _id: "user-1" }, body: {}, params: { mentorId: "mentor-1" } };
  for (const method of ["lock", "unlock", "unlockAll", "active"]) {
    assert.equal((await invoke(controller[method], req)).error, failure);
  }
});
