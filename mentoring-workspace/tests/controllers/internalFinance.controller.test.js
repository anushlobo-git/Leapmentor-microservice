const test = require("node:test");
const assert = require("node:assert/strict");

const createInternalFinanceController = require("../../controllers/internalFinance.controller");

const response = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const invoke = async (handler, req) => {
  const res = response();
  let error;
  await handler(req, res, (value) => { error = value; });
  return { res, error };
};

test("validates and publishes invoice email events through the Workspace outbox client", async () => {
  const events = [];
  const controller = createInternalFinanceController({
    financeRepository: {},
    identityClient: {},
    profileClient: {},
    notificationClient: {
      publish: async (event, correlationId) => {
        events.push({ event, correlationId });
        return { delivered: true };
      },
    },
  });
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await controller.queueInvoiceEmail(
    {
      body: {
        sourceEventId: "payment-invoice:request-1",
        reporterEmail: "mentee@example.com",
        invoicePdfBase64: "JVBERi0=",
      },
      correlationId: "corr-1",
    },
    res,
    assert.fail,
  );
  assert.equal(res.statusCode, 202);
  assert.equal(events[0].event.eventType, "payment.invoice.email");
  assert.equal(events[0].correlationId, "corr-1");
});

test("rejects incomplete or oversized invoice email events before publishing", async () => {
  const controller = createInternalFinanceController({
    financeRepository: {},
    identityClient: {},
    profileClient: {},
    notificationClient: {
      publish: async () => assert.fail("invalid event must not publish"),
    },
  });
  const call = async (body) => {
    const res = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json() {},
    };
    await controller.queueInvoiceEmail({ body }, res, assert.fail);
    return res.statusCode;
  };
  assert.equal(await call({}), 400);
  assert.equal(
    await call({
      sourceEventId: "invoice:1",
      reporterEmail: "x@y.com",
      invoicePdfBase64: "x".repeat(4_000_001),
    }),
    413,
  );
});

test("queues non-invoice email events through the durable notification outbox", async () => {
  const events = [];
  const controller = createInternalFinanceController({
    financeRepository: {},
    identityClient: {},
    profileClient: {},
    notificationClient: {
      publish: async (event, correlationId) => {
        events.push({ event, correlationId });
        return { delivered: true };
      },
    },
  });
  const res = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await controller.queueEmailEvent(
    {
      body: {
        eventType: "payment.received.email",
        sourceEventId: "payment-received:request-1",
        mentorEmail: "mentor@example.com",
      },
      correlationId: "corr-email",
    },
    res,
    assert.fail,
  );

  assert.equal(res.statusCode, 202);
  assert.equal(events[0].event.eventType, "payment.received.email");
  assert.equal(events[0].correlationId, "corr-email");
});

test("invoice context returns participant summaries and handles missing records", async () => {
  const request = { mentee: "mentee-1", mentor: "mentor-1", totalAmount: 100 };
  const controller = createInternalFinanceController({
    financeRepository: { findInvoiceContext: async () => request },
    identityClient: {
      getUserSummaryMap: async (ids, correlationId) => {
        assert.deepEqual(ids, ["mentee-1", "mentor-1"]);
        assert.equal(correlationId, "corr-context");
        return new Map([
          ["mentee-1", { name: "Mentee" }],
          ["mentor-1", { name: "Mentor" }],
        ]);
      },
    },
    profileClient: {},
    notificationClient: {},
  });
  const result = await invoke(controller.getInvoiceContext, {
    params: { requestId: "request-1" },
    correlationId: "corr-context",
  });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body.data.mentee.name, "Mentee");
  assert.equal(result.res.body.data.mentor.name, "Mentor");

  const missing = await invoke(createInternalFinanceController({
    financeRepository: { findInvoiceContext: async () => null },
    identityClient: {},
    profileClient: {},
    notificationClient: {},
  }).getInvoiceContext, { params: { requestId: "missing" } });
  assert.equal(missing.res.statusCode, 404);
  assert.equal(missing.res.body.code, "SESSION_NOT_FOUND");
});

test("mentor session listing selects status, validates dates, and decorates available users", async () => {
  let criteria;
  const controller = createInternalFinanceController({
    financeRepository: {
      findMentorSessions: async (...args) => {
        criteria = args;
        return [{ mentee: { _id: "mentee-1" } }, { mentee: "unknown" }, { mentee: null }];
      },
    },
    identityClient: {
      getUserSummaryMap: async (ids) => {
        assert.deepEqual(ids, ["mentee-1", "unknown"]);
        return new Map([["mentee-1", { name: "Mentee" }]]);
      },
    },
    profileClient: {},
    notificationClient: {},
  });
  const result = await invoke(controller.getMentorSessions, {
    params: { mentorId: "mentor-1" },
    query: { status: "ongoing", since: "2026-03-01" },
    correlationId: "corr-sessions",
  });
  assert.equal(result.res.statusCode, 200);
  assert.equal(criteria[0], "mentor-1");
  assert.equal(criteria[1], "ongoing");
  assert.equal(criteria[2].toISOString(), new Date("2026-03-01").toISOString());
  assert.equal(result.res.body.data.sessions[0].mentee.name, "Mentee");
  assert.equal(result.res.body.data.sessions[1].mentee, "unknown");
  assert.equal(result.res.body.data.sessions[2].mentee, null);

  const invalidDate = await invoke(controller.getMentorSessions, {
    params: { mentorId: "mentor-1" },
    query: { since: "not-a-date" },
  });
  assert.equal(invalidDate.res.statusCode, 400);
  assert.equal(invalidDate.res.body.code, "INVALID_DATE");
});

test("payout listing filters by mentee search, clamps pagination, and returns decorated rows", async () => {
  let countArgs;
  let listArgs;
  const controller = createInternalFinanceController({
    financeRepository: {
      countPayouts: async (filter) => {
        countArgs = filter;
        return 45;
      },
      findPayouts: async (filter, options) => {
        listArgs = { filter, options };
        return [{ mentee: "mentee-1" }];
      },
    },
    identityClient: {
      searchUserSummaries: async (query, role, correlationId) => {
        assert.equal(query, "Alex");
        assert.equal(role, "mentee");
        assert.equal(correlationId, "corr-payout");
        return [{ _id: "mentee-1" }];
      },
      getUserSummaryMap: async () => new Map([["mentee-1", { name: "Alex" }]]),
    },
    profileClient: {},
    notificationClient: {},
  });
  const result = await invoke(controller.getPayouts, {
    params: { mentorId: "mentor-1" },
    query: { search: " Alex ", page: "3", limit: "50" },
    correlationId: "corr-payout",
  });
  assert.equal(result.res.statusCode, 200);
  assert.deepEqual(countArgs, {
    mentor: "mentor-1",
    status: "completed",
    mentee: { $in: ["mentee-1"] },
  });
  assert.deepEqual(listArgs.options, { skip: 40, limit: 20 });
  assert.equal(result.res.body.data.payouts[0].mentee.name, "Alex");
  assert.deepEqual(result.res.body.data.pagination, {
    totalCount: 45,
    currentPage: 3,
    totalPages: 3,
    hasMore: false,
  });
});

test("payout listing skips blank search and handles zero results", async () => {
  let filter;
  const controller = createInternalFinanceController({
    financeRepository: {
      countPayouts: async (value) => {
        filter = value;
        return 0;
      },
      findPayouts: async () => [],
    },
    identityClient: { getUserSummaryMap: async () => new Map() },
    profileClient: {},
    notificationClient: {},
  });
  const result = await invoke(controller.getPayouts, {
    params: { mentorId: "mentor-1" },
    query: { search: "   ", page: "invalid", limit: "0" },
  });
  assert.equal(result.res.statusCode, 200);
  assert.deepEqual(filter, { mentor: "mentor-1", status: "completed" });
  assert.deepEqual(result.res.body.data.pagination, {
    totalCount: 0,
    currentPage: 1,
    totalPages: 0,
    hasMore: false,
  });
});

test("mentor rating delegates the mentor ID and correlation ID", async () => {
  const controller = createInternalFinanceController({
    financeRepository: {},
    identityClient: {},
    profileClient: {
      getMentorRating: async (mentorId, correlationId) => ({
        mentorId,
        correlationId,
      }),
    },
    notificationClient: {},
  });
  const result = await invoke(controller.getMentorRating, {
    params: { mentorId: "mentor-1" },
    correlationId: "corr-rating",
  });
  assert.equal(result.res.statusCode, 200);
  assert.deepEqual(result.res.body.data, {
    mentorId: "mentor-1",
    correlationId: "corr-rating",
  });
});

test("email event validation and downstream failures are forwarded or rejected", async () => {
  const expected = new Error("notification service unavailable");
  const controller = createInternalFinanceController({
    financeRepository: {},
    identityClient: {},
    profileClient: {},
    notificationClient: { publish: async () => { throw expected; } },
  });
  const invoice = await invoke(controller.queueInvoiceEmail, {
    body: { sourceEventId: "id", reporterEmail: "x@example.com", invoicePdfBase64: "x" },
  });
  assert.equal(invoice.error, expected);

  const incompleteEmail = await invoke(controller.queueEmailEvent, { body: {} });
  assert.equal(incompleteEmail.res.statusCode, 400);
  assert.equal(incompleteEmail.res.body.code, "INVALID_EMAIL_EVENT");

  const oversizedEmail = await invoke(controller.queueEmailEvent, {
    body: {
      sourceEventId: "id",
      eventType: "payment.email",
      invoicePdfBase64: "x".repeat(4_000_001),
    },
  });
  assert.equal(oversizedEmail.res.statusCode, 413);
  assert.equal(oversizedEmail.res.body.code, "INVOICE_ATTACHMENT_TOO_LARGE");

  const validEmail = await invoke(createInternalFinanceController({
    financeRepository: {},
    identityClient: {},
    profileClient: {},
    notificationClient: { publish: async (event) => event },
  }).queueEmailEvent, {
    body: { sourceEventId: "id", eventType: "payment.email" },
  });
  assert.equal(validEmail.res.statusCode, 202);
  assert.equal(validEmail.res.body.data.eventType, "payment.email");
});

test("finance endpoints pass repository and client errors to error middleware", async () => {
  const expected = new Error("backend failed");
  const common = {
    financeRepository: {
      findInvoiceContext: async () => { throw expected; },
      findMentorSessions: async () => { throw expected; },
      countPayouts: async () => { throw expected; },
    },
    identityClient: {
      getUserSummaryMap: async () => { throw expected; },
      searchUserSummaries: async () => { throw expected; },
    },
    profileClient: { getMentorRating: async () => { throw expected; } },
    notificationClient: { publish: async () => { throw expected; } },
  };
  const controller = createInternalFinanceController(common);
  const context = await invoke(controller.getInvoiceContext, {
    params: { requestId: "id" },
  });
  assert.equal(context.error, expected);

  const sessions = await invoke(controller.getMentorSessions, {
    params: { mentorId: "id" },
    query: {},
  });
  assert.equal(sessions.error, expected);

  const payouts = await invoke(controller.getPayouts, {
    params: { mentorId: "id" },
    query: { search: "person" },
  });
  assert.equal(payouts.error, expected);

  const rating = await invoke(controller.getMentorRating, {
    params: { mentorId: "id" },
  });
  assert.equal(rating.error, expected);
});
