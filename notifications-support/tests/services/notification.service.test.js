const test = require("node:test");
const assert = require("node:assert/strict");

const createNotificationService = require("../../services/notification.service");

const createService = (overrides = {}) => {
  const notifications = [
    { _id: "notification-1", recipient: "user-1", type: "new_message", title: "New message", message: "Hello", read: false, metadata: {} },
  ];
  const calls = [];
  const repository = {
    findByRecipientLimit: async (...args) => { calls.push(["list", ...args]); return notifications; },
    updateManyReadStatus: async (...args) => { calls.push(["mark-all", ...args]); },
    findOneAndUpdateByRecipient: async (...args) => { calls.push(["mark-one", ...args]); return notifications[0]; },
    deleteOneByRecipient: async (...args) => { calls.push(["delete-one", ...args]); return notifications[0]; },
    deleteManyByRecipient: async (...args) => { calls.push(["clear", ...args]); },
    ...overrides.repository,
  };
  return { service: createNotificationService({ notificationRepository: repository }), calls };
};

test("lists a recipient's notifications with the frontend-compatible DTO", async () => {
  const { service, calls } = createService();
  const result = await service.getRecipientNotifications("user-1");
  assert.equal(result[0].id, "notification-1");
  assert.equal(result[0].read, false);
  assert.deepEqual(calls[0], ["list", "user-1", 50]);
});

test("scopes all mutations to the authenticated recipient", async () => {
  const { service, calls } = createService();
  await service.markAllNotificationsAsRead("user-1");
  await service.markOneNotificationAsRead("notification-1", "user-1");
  await service.removeNotificationRecord("notification-1", "user-1");
  await service.clearAllUserNotifications("user-1");
  assert.deepEqual(calls.map((call) => call[0]), ["mark-all", "mark-one", "delete-one", "clear"]);
  assert.equal(calls[1][2], "user-1");
  assert.equal(calls[2][2], "user-1");
  assert.equal(calls[3][1], "user-1");
});

test("returns stable not-found errors for isolated notification mutations", async () => {
  const { service } = createService({
    repository: {
      findOneAndUpdateByRecipient: async () => null,
      deleteOneByRecipient: async () => null,
    },
  });
  await assert.rejects(service.markOneNotificationAsRead("missing", "user-1"), { statusCode: 404, code: "NOTIFICATION_NOT_FOUND" });
  await assert.rejects(service.removeNotificationRecord("missing", "user-1"), { statusCode: 404, code: "NOTIFICATION_NOT_FOUND" });
});
