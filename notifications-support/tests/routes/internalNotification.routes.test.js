const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createInternalNotificationRouter = require("../../routes/internalNotification.routes");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("internal notification command requires the Workspace service token", async () => {
  const controller = { create: async (_req, res) => res.status(201).json({ success: true, data: { deduplicated: false } }) };
  const serverDetails = await startServer({
    health: { isReady: () => true },
    internalServiceAuth: createInternalServiceAuth({ serviceToken: "workspace-token" }),
    internalNotificationRouter: createInternalNotificationRouter({ controller, validation: { validateNotificationEvent: (_req, _res, next) => next() } }),
  });
  try {
    const payload = JSON.stringify({ sourceEventId: "event-1" });
    const unauthorized = await fetch(`${serverDetails.url}/internal/v1/notifications`, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    assert.equal(unauthorized.status, 401);
    const authorized = await fetch(`${serverDetails.url}/internal/v1/notifications`, { method: "POST", headers: { Authorization: "Bearer workspace-token", "Content-Type": "application/json" }, body: payload });
    assert.equal(authorized.status, 201);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
