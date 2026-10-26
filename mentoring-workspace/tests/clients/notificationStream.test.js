const test = require("node:test");
const assert = require("node:assert/strict");

const createNotificationStreamPublisher = require("../../clients/notificationStream");

test("publishes notification events as Redis Stream records", async () => {
  const calls = [];
  const client = {
    isOpen: true,
    isReady: true,
    xAdd: async (...args) => calls.push(args),
    on: () => {},
  };
  const publisher = createNotificationStreamPublisher({ client, streamName: "notifications", enabled: true });
  const result = await publisher.publish({ sourceEventId: "event-1", type: "new_message", recipient: "user-1" }, "corr-1");
  assert.deepEqual(result, { delivered: true, transport: "redis-stream" });
  assert.equal(calls[0][0], "notifications");
  assert.equal(calls[0][2].sourceEventId, "event-1");
  assert.equal(JSON.parse(calls[0][2].payload).recipient, "user-1");
});

test("does not publish when Redis transport is disabled", async () => {
  const publisher = createNotificationStreamPublisher({ client: { isReady: true }, streamName: "notifications", enabled: false });
  assert.deepEqual(await publisher.publish({ sourceEventId: "event-1" }), { delivered: false, skipped: true });
});
