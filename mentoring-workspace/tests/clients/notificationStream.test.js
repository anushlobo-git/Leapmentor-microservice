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

test("connects only when enabled and closes only open clients", async () => {
  let connectCalls = 0;
  let quitCalls = 0;
  const handlers = {};
  const client = {
    isOpen: false,
    isReady: false,
    on: (event, handler) => { handlers[event] = handler; },
    connect: async () => {
      connectCalls += 1;
      client.isOpen = true;
    },
    quit: async () => {
      quitCalls += 1;
      client.isOpen = false;
    },
  };
  const publisher = createNotificationStreamPublisher({
    client,
    streamName: "notifications",
    enabled: true,
  });
  assert.equal(await publisher.connect(), true);
  assert.equal(connectCalls, 1);
  assert.equal(typeof handlers.error, "function");
  await publisher.close();
  assert.equal(quitCalls, 1);
  await publisher.close();
  assert.equal(quitCalls, 1);

  const alreadyOpen = createNotificationStreamPublisher({
    client: { isOpen: true, isReady: false },
    streamName: "notifications",
    enabled: true,
  });
  assert.equal(await alreadyOpen.connect(), true);
  const disabled = createNotificationStreamPublisher({
    client: { isOpen: false },
    streamName: "notifications",
    enabled: false,
  });
  assert.equal(await disabled.connect(), false);
});

test("skips publishing when Redis is not ready and uses envelope defaults when ready", async () => {
  let record;
  const notReady = createNotificationStreamPublisher({
    client: { isReady: false },
    streamName: "notifications",
    enabled: true,
  });
  assert.deepEqual(await notReady.publish({ sourceEventId: "event-1" }), {
    delivered: false,
    skipped: true,
  });

  const ready = createNotificationStreamPublisher({
    client: {
      isReady: true,
      xAdd: async (...args) => { record = args; },
    },
    streamName: "notifications",
    enabled: true,
  });
  await ready.publish({}, "corr-defaults");
  assert.equal(record[2].sourceEventId.length > 0, true);
  assert.equal(record[2].eventType, "notification.requested");
  const envelope = JSON.parse(record[2].payload);
  assert.equal(envelope.correlationId, "corr-defaults");
  assert.equal(envelope.producer, "mentoring-workspace");
  assert.equal(envelope.schemaVersion, 1);
});
