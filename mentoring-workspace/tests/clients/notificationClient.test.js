const test = require("node:test");
const assert = require("node:assert/strict");

const createNotificationClient = require("../../clients/notificationClient");

test("publishes an idempotent notification command with correlation and event headers", async () => {
  const calls = [];
  const client = createNotificationClient({
    serviceToken: "workspace-token",
    httpClient: { request: async (request) => { calls.push(request); return { data: { deduplicated: false } }; } },
  });
  const result = await client.publish({ sourceEventId: "event-1", recipient: "user-1", type: "new_message", title: "New message", message: "Hello" }, "correlation-1");
  assert.equal(result.delivered, true);
  assert.equal(calls[0].path, "/internal/v1/notifications");
  assert.equal(calls[0].correlationId, "correlation-1");
  assert.equal(calls[0].idempotencyKey, "event-1");
});

test("fails open when notification service delivery is unavailable", async () => {
  const client = createNotificationClient({
    serviceToken: "workspace-token",
    httpClient: { request: async () => { throw new Error("service down"); } },
  });
  const result = await client.publish({ sourceEventId: "event-1" });
  assert.equal(result.delivered, false);
});

test("falls back to REST when Redis is enabled but not ready", async () => {
  const calls = [];
  const client = createNotificationClient({
    serviceToken: "workspace-token",
    streamPublisher: { publish: async () => ({ delivered: false, skipped: true }) },
    httpClient: { request: async (request) => { calls.push(request); return { data: { deduplicated: false } }; } },
  });
  const result = await client.publish({ sourceEventId: "event-1" });
  assert.equal(result.delivered, true);
  assert.equal(calls.length, 1);
});
