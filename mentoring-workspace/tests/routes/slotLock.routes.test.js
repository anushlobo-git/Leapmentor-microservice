const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createSlotLockRouter = require("../../routes/slotLock.routes");
const createSlotLockController = require("../../controllers/slotLock.controller");
const createAuthenticate = require("../../middleware/authenticate");
const validations = require("../../middleware/slotLockValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("slot-lock route authenticates and returns the lock response", async () => {
  const controller = createSlotLockController({
    slotLockService: {
      acquireSlotLock: async (userId, body) => ({ lockedBy: userId, ...body, lockedFor: 10 }),
      releaseSlotLock: async () => undefined,
      releaseAllUserLocks: async () => undefined,
      getMentorActiveLocks: async () => ({ locks: [] }),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    slotLockRouter: createSlotLockRouter({
      controller,
      authenticate: createAuthenticate({ accessSecret: "test-secret" }),
      validations,
    }),
  });

  try {
    const token = jwt.sign({ id: "mentee-1", type: "access" }, "test-secret");
    const response = await fetch(`${serverDetails.url}/api/v1/slot-locks/lock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mentorId: "507f1f77bcf86cd799439011", date: "2099-01-01", startTime: "10:00", endTime: "11:00" }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.lockedBy, "mentee-1");
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
