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

test("queues events in the outbox, generates missing event IDs, and marks delivery", async () => {
  const operations = [];
  const client = createNotificationClient({
    serviceToken: "token",
    httpClient: { request: async () => ({ data: { accepted: true } }) },
    outboxRepository: {
      enqueue: async (event) => {
        operations.push(["enqueue", event]);
        return { _id: "outbox-1", payload: event.payload, correlationId: event.correlationId, attempts: 1 };
      },
      markDelivered: async (id) => operations.push(["delivered", id]),
    },
  });
  const result = await client.publish({ eventType: "notice" }, "corr-outbox");
  assert.equal(result.delivered, true);
  assert.equal(operations[0][1].sourceEventId.length > 0, true);
  assert.equal(operations[0][1].eventId.length > 0, true);
  assert.equal(operations[0][1].payload.correlationId, "corr-outbox");
  assert.deepEqual(operations[1], ["delivered", "outbox-1"]);
});

test("routes invoice and email events to their dedicated notification endpoints", async () => {
  const paths = [];
  const client = createNotificationClient({
    serviceToken: "token",
    httpClient: {
      request: async (request) => {
        paths.push(request.path);
        return {};
      },
    },
  });
  await client.publish({ eventType: "payment.invoice.email", sourceEventId: "invoice-1" });
  await client.publish({ eventType: "report.submitted.email", sourceEventId: "report-1" });
  assert.deepEqual(paths, [
    "/internal/v1/email-events/invoice-events",
    "/internal/v1/email-events/report-events",
  ]);
});

test("marks events failed when token is missing or REST delivery throws", async () => {
  const failures = [];
  const outboxRepository = {
    enqueue: async (event) => ({
      _id: "outbox-2",
      payload: event.payload,
      correlationId: event.correlationId,
      attempts: 3,
    }),
    markFailed: async (...args) => failures.push(args),
  };
  const noToken = createNotificationClient({ outboxRepository });
  const skipped = await noToken.publish({ sourceEventId: "skip" });
  assert.deepEqual(skipped, { delivered: false, skipped: true });
  assert.deepEqual(failures[0], ["outbox-2", "NOTIFICATIONS_SERVICE_TOKEN_MISSING", 3]);

  const failed = createNotificationClient({
    serviceToken: "token",
    httpClient: { request: async () => { const error = new Error("failed"); error.code = "HTTP_503"; throw error; } },
    outboxRepository,
  });
  const result = await failed.publish({ sourceEventId: "failure" });
  assert.deepEqual(result, { delivered: false, error: "HTTP_503" });
  assert.deepEqual(failures[1], ["outbox-2", "HTTP_503", 3]);
});

test("prefers successful stream delivery and falls back after stream errors", async () => {
  const calls = [];
  const outboxRepository = {
    enqueue: async (event) => ({
      _id: "outbox-stream",
      payload: event.payload,
      correlationId: event.correlationId,
    }),
    markDelivered: async (id) => calls.push(["delivered", id]),
    markFailed: async (...args) => calls.push(["failed", ...args]),
  };
  const streamResult = await createNotificationClient({
    streamPublisher: { publish: async () => ({ delivered: true, stream: true }) },
    outboxRepository,
  }).publish({ sourceEventId: "streamed" });
  assert.deepEqual(streamResult, { delivered: true, stream: true });
  assert.deepEqual(calls[0], ["delivered", "outbox-stream"]);

  const stderrWrite = process.stderr.write;
  const errors = [];
  process.stderr.write = (message) => { errors.push(String(message)); return true; };
  try {
    const client = createNotificationClient({
      serviceToken: "token",
      streamPublisher: { publish: async () => { throw new Error("stream unavailable"); } },
      httpClient: { request: async () => ({}) },
      outboxRepository,
    });
    const result = await client.publish({ sourceEventId: "fallback" });
    assert.equal(result.delivered, true);
    assert.equal(errors.some((message) => message.includes("stream unavailable")), true);
  } finally {
    process.stderr.write = stderrWrite;
  }
});

test("drains pending outbox events and rejects overlapping drains", async () => {
  const marks = [];
  let releaseDelivery;
  let startedDelivery;
  const started = new Promise((resolve) => { startedDelivery = resolve; });
  const waiting = new Promise((resolve) => { releaseDelivery = resolve; });
  const client = createNotificationClient({
    serviceToken: "token",
    httpClient: {
      request: async () => {
        startedDelivery();
        await waiting;
        return {};
      },
    },
    outboxRepository: {
      findPending: async () => [
        { _id: "event-1", payload: {}, attempts: 1 },
        { _id: "event-2", payload: {}, attempts: 1 },
      ],
      markDelivered: async (id) => marks.push(id),
    },
  });
  const firstDrain = client.drain();
  await started;
  assert.deepEqual(await client.drain(), { attempted: 0, skipped: true });
  releaseDelivery();
  assert.deepEqual(await firstDrain, { attempted: 2, delivered: 2 });
  assert.deepEqual(marks, ["event-1", "event-2"]);

  assert.deepEqual(await createNotificationClient({}).drain(), { attempted: 0 });
});
