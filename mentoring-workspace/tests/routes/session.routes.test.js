const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createSessionRouter = require("../../routes/session.routes");
const createSessionController = require("../../controllers/session.controller");
const createAuthenticate = require("../../middleware/authenticate");
const validations = require("../../middleware/sessionValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("session slot route authenticates and returns the session slot projection", async () => {
  const controller = createSessionController({ sessionService: { getSlots: async () => ({ slots: [], additionalSlots: [], progress: 0 }), setMeetingLink: async () => ({}), markSlotComplete: async () => ({}), addSlot: async () => ({}), cancelSlot: async () => ({}), rescheduleSlot: async () => ({}) } });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    sessionRouter: createSessionRouter({ controller, authenticate: createAuthenticate({ accessSecret: "test-secret" }), validations }),
  });
  try {
    const token = jwt.sign({ id: "mentee-1", type: "access" }, "test-secret");
    const response = await fetch(`${serverDetails.url}/api/v1/sessions/507f1f77bcf86cd799439011/slots`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.slots, []);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
