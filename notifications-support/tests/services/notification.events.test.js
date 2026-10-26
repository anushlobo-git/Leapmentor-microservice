const test = require("node:test");
const assert = require("node:assert/strict");

const createNotificationService = require("../../services/notification.service");

test("creates a notification event and deduplicates retries by source event id", async () => {
  const stored = new Map();
  const repository = {
    findBySourceEventId: async (id) => stored.get(id) || null,
    createNotification: async (data) => {
      const notification = { _id: "notification-1", ...data };
      stored.set(data.sourceEventId, notification);
      return notification;
    },
  };
  const service = createNotificationService({ notificationRepository: repository });
  const payload = {
    sourceEventId: "workspace.request.request-1.accepted",
    recipient: "507f1f77bcf86cd799439011",
    type: "connect_request_accepted",
    title: "Request accepted",
    message: "Your mentoring request was accepted.",
    metadata: { requestId: "507f1f77bcf86cd799439012" },
  };
  const first = await service.createFromEvent(payload);
  const retry = await service.createFromEvent(payload);
  assert.equal(first.deduplicated, false);
  assert.equal(retry.deduplicated, true);
  assert.equal(retry.notification.id, "notification-1");
});

test("rejects unsupported notification event types", async () => {
  const service = createNotificationService({ notificationRepository: { findBySourceEventId: async () => null } });
  await assert.rejects(service.createFromEvent({
    sourceEventId: "event-1",
    recipient: "507f1f77bcf86cd799439011",
    type: "not_supported",
    title: "Title",
    message: "Message",
  }), { statusCode: 400, code: "INVALID_NOTIFICATION_TYPE" });
});
