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
      if (reads === 1)
        return [
          {
            name: "notifications",
            messages: [
              {
                id: "1-0",
                message: {
                  payload: JSON.stringify({
                    sourceEventId: "event-1",
                    recipient: "user-1",
                    type: "new_message",
                    title: "New",
                    message: "Hello",
                  }),
                },
              },
            ],
          },
        ];
      return null;
    },
    xAck: async (...args) => calls.push(["ack", ...args]),
    quit: async () => {
      client.isOpen = false;
    },
  };
  const events = [];
  const consumer = createNotificationConsumer({
    client,
    streamName: "notifications",
    groupName: "notifications-support",
    consumerName: "test-consumer",
    notificationService: {
      createFromEvent: async (event) => events.push(event),
    },
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
  const consumer = createNotificationConsumer({
    client: {},
    streamName: "notifications",
    groupName: "group",
    consumerName: "consumer",
    notificationService: {},
    enabled: false,
  });
  assert.equal(await consumer.start(), false);
});

test("dispatches report email events to the email service and acknowledges only after delivery", async () => {
  const calls = [];
  let reads = 0;
  const client = {
    isOpen: true,
    on: () => {},
    xGroupCreate: async () => {},
    xReadGroup: async () => {
      reads += 1;
      if (reads > 1) return null;
      return [
        {
          name: "notifications",
          messages: [
            {
              id: "2-0",
              message: {
                payload: JSON.stringify({
                  eventType: "report.submitted.email",
                  sourceEventId: "report-1",
                }),
              },
            },
          ],
        },
      ];
    },
    xAck: async (...args) => calls.push(["ack", ...args]),
    quit: async () => {
      client.isOpen = false;
    },
  };
  const consumer = createNotificationConsumer({
    client,
    streamName: "notifications",
    groupName: "group",
    consumerName: "email-test",
    notificationService: {
      createFromEvent: async () =>
        assert.fail("email event must not create an in-app notification"),
    },
    reportEmailService: {
      sendReportEvent: async (event) =>
        calls.push(["email", event.sourceEventId]),
    },
    enabled: true,
  });
  await consumer.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await consumer.stop();
  assert.deepEqual(calls, [
    ["email", "report-1"],
    ["ack", "notifications", "group", "2-0"],
  ]);
});

test("dispatches payment invoice events from Redis to the email service", async () => {
  const calls = [];
  let reads = 0;
  const client = {
    isOpen: true,
    on: () => {},
    xGroupCreate: async () => {},
    xReadGroup: async () => {
      reads += 1;
      if (reads > 1) return null;
      return [
        {
          name: "notifications",
          messages: [
            {
              id: "3-0",
              message: {
                payload: JSON.stringify({
                  eventType: "payment.invoice.email",
                  sourceEventId: "payment-invoice:1",
                }),
              },
            },
          ],
        },
      ];
    },
    xAck: async (...args) => calls.push(["ack", ...args]),
    quit: async () => {
      client.isOpen = false;
    },
  };
  const consumer = createNotificationConsumer({
    client,
    streamName: "notifications",
    groupName: "group",
    consumerName: "invoice-test",
    notificationService: {
      createFromEvent: async () =>
        assert.fail("invoice email must not create an in-app notification"),
    },
    reportEmailService: {
      sendReportEvent: async (event) =>
        calls.push(["email", event.sourceEventId]),
    },
    enabled: true,
  });
  await consumer.start();
  await new Promise((resolve) => setTimeout(resolve, 10));
  await consumer.stop();
  assert.deepEqual(calls, [
    ["email", "payment-invoice:1"],
    ["ack", "notifications", "group", "3-0"],
  ]);
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
    quit: async () => {
      client.isOpen = false;
    },
  };
  const consumer = createNotificationConsumer({
    client,
    streamName: "notifications",
    groupName: "group",
    consumerName: "consumer",
    notificationService: {},
    enabled: true,
  });
  await consumer.start();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await consumer.stop();
  assert.equal(calls[0][0], "claim");
});

test("moves a poison event to the dead-letter stream after five failures", async () => {
  const calls = [];
  const counts = new Map();
  let reads = 0;
  let consumer;
  const record = {
    id: "9-0",
    message: {
      payload: JSON.stringify({
        sourceEventId: "poison-1",
        type: "unsupported",
      }),
    },
  };
  const client = {
    isOpen: true,
    on: () => {},
    xGroupCreate: async () => {},
    xAutoClaim: async () => ({ messages: [] }),
    xReadGroup: async () => {
      reads += 1;
      if (reads <= 5) return [{ name: "events", messages: [record] }];
      return null;
    },
    hIncrBy: async (_key, field) => {
      const attempts = (counts.get(field) || 0) + 1;
      counts.set(field, attempts);
      return attempts;
    },
    hDel: async (_key, field) => counts.delete(field),
    xAdd: async (...args) => calls.push(["dead-letter", ...args]),
    xAck: async (...args) => {
      calls.push(["ack", ...args]);
      queueMicrotask(() => consumer.stop());
    },
    quit: async () => {
      client.isOpen = false;
    },
  };
  consumer = createNotificationConsumer({
    client,
    streamName: "events",
    groupName: "group",
    consumerName: "poison-test",
    notificationService: {
      createFromEvent: async () => {
        throw new Error("unsupported event");
      },
    },
    maxDeliveries: 5,
    enabled: true,
  });
  await consumer.start();
  while (client.isOpen && calls.length === 0)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(calls[0][0], "dead-letter");
  assert.equal(calls[0][1], "events:dead-letter");
  assert.equal(calls[0][3].sourceMessageId, "9-0");
  assert.equal(calls[0][3].deliveryAttempts, "5");
  assert.deepEqual(calls[1], ["ack", "events", "group", "9-0"]);
});

test("replays a dead-letter event to the original stream and removes the DLQ row", async () => {
  const calls = [];
  const client = {
    xRange: async (...args) => {
      calls.push(["range", ...args]);
      return [
        {
          id: "1710000000000-0",
          message: {
            payload: '{"sourceEventId":"event-replay"}',
            sourceMessageId: "5-0",
          },
        },
      ];
    },
    xAdd: async (...args) => calls.push(["add", ...args]),
    xDel: async (...args) => calls.push(["delete", ...args]),
  };
  const consumer = createNotificationConsumer({
    client,
    streamName: "events",
    groupName: "group",
    consumerName: "replay-test",
    notificationService: {},
  });
  assert.deepEqual(await consumer.replayDeadLetter("1710000000000-0"), {
    replayed: true,
    sourceMessageId: "5-0",
  });
  assert.deepEqual(calls[1], [
    "add",
    "events",
    "*",
    { payload: '{"sourceEventId":"event-replay"}' },
  ]);
  assert.deepEqual(calls[2], [
    "delete",
    "events:dead-letter",
    "1710000000000-0",
  ]);
});
