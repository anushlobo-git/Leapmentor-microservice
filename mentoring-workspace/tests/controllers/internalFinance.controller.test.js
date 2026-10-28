const test = require("node:test");
const assert = require("node:assert/strict");

const createInternalFinanceController = require("../../controllers/internalFinance.controller");

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
