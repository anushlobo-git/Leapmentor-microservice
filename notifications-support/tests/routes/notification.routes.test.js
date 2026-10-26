const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createNotificationRouter = require("../../routes/notification.routes");
const createNotificationController = require("../../controllers/notification.controller");
const { createAuthenticate } = require("../../middleware/authenticate");
const validations = require("../../middleware/notificationValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("notification list and read routes authenticate and preserve the public contract", async () => {
  const controller = createNotificationController({
    notificationService: {
      getRecipientNotifications: async () => [{ id: "notification-1", read: false }],
      markAllNotificationsAsRead: async () => {},
      markOneNotificationAsRead: async () => {},
      removeNotificationRecord: async () => {},
      clearAllUserNotifications: async () => {},
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    notificationRouter: createNotificationRouter({ controller, authenticate: createAuthenticate({ accessSecret: "test-secret" }), validations }),
  });
  try {
    const token = jwt.sign({ id: "user-1", type: "access" }, "test-secret");
    const headers = { Authorization: `Bearer ${token}` };
    const list = await fetch(`${serverDetails.url}/api/v1/notifications`, { headers });
    assert.equal(list.status, 200);
    assert.deepEqual((await list.json()).data.notifications, [{ id: "notification-1", read: false }]);
    const markAll = await fetch(`${serverDetails.url}/api/v1/notifications/mark-all-read`, { method: "PATCH", headers });
    assert.equal(markAll.status, 200);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("notification mutations reject malformed identifiers", async () => {
  const controller = createNotificationController({ notificationService: {} });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    notificationRouter: createNotificationRouter({ controller, authenticate: createAuthenticate({ accessSecret: "test-secret" }), validations }),
  });
  try {
    const token = jwt.sign({ id: "user-1", type: "access" }, "test-secret");
    const response = await fetch(`${serverDetails.url}/api/v1/notifications/not-an-id/read`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_NOTIFICATION_ID");
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
