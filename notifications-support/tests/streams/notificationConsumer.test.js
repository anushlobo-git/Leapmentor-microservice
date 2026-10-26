const test = require("node:test");
const assert = require("node:assert/strict");

const createNotificationConsumer = require("../../streams/notificationConsumer");

test("creates a consumer group and acknowledges successfully processed events", async () => {
  const calls = [];
  let reads = 0;
  const client = {
    isOpen: true,
    on: () => {},
    xGroupCreate: async (...args) => calls.push(["group", ...args]),
    xReadGroup: async () => {
      reads += 1;
      if (reads === 1) return [{ name: "notifications", messages: [{ id: "1-0", message: { payload: JSON.stringify({ sourceEventId: "event-1", recipient: "user-1", type: "new_message", title: "New", message: "Hello" }) } }] }];
      return null;
    },
    xAck: async (...args) => calls.push(["ack", ...args]),
    quit: async () => { client.isOpen = false; },
  };
  const events = [];
  const consumer = createNotificationConsumer({
    client,
    streamName: "notifications",
    groupName: "notifications-support",
    consumerName: "test-consumer",
    notificationService: { createFromEvent: async (event) => events.push(event) },
    enabled: true,
  });
  await consumer.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await consumer.stop();
  assert.equal(calls[0][0], "group");
  assert.equal(calls.at(-1)[0], "ack");
  assert.equal(events[0].sourceEventId, "event-1");
});

test("stays inert when Redis transport is disabled", async () => {
  const consumer = createNotificationConsumer({ client: {}, streamName: "notifications", groupName: "group", consumerName: "consumer", notificationService: {}, enabled: false });
  assert.equal(await consumer.start(), false);
});

test("claims idle pending records before reading new records", async () => {
  const calls = [];
  const client = {
    isOpen: true,
    on: () => {},
    xGroupCreate: async () => {},
    xAutoClaim: async (...args) => {
      calls.push(["claim", ...args]);
      return { nextId: "0-0", messages: [] };
    },
    xReadGroup: async () => null,
    quit: async () => { client.isOpen = false; },
  };
  const consumer = createNotificationConsumer({ client, streamName: "notifications", groupName: "group", consumerName: "consumer", notificationService: {}, enabled: true });
  await consumer.start();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await consumer.stop();
  assert.equal(calls[0][0], "claim");
});
