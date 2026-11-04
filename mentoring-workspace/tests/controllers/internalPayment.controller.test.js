const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/internalPayment.controller");

const invoke = async (handler, req) => {
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
  let error;
  await handler(req, res, (value) => { error = value; });
  return { res, error };
};

test("payment context returns records and backfills missing pricing when valid", async () => {
  let profileLookup;
  const controller = createController({
    connectRequestPaymentRepository: {
      findPaymentContext: async () => ({
        mentor: "mentor-1",
        sessionRate: null,
        selectedSlots: [{}, {}],
      }),
      updatePaymentState: async () => ({ status: "paid" }),
    },
    profileClient: {
      getMentorProfile: async (...args) => {
        profileLookup = args;
        return { hourlyRate: "75" };
      },
    },
    sessionService: { addSlot: async () => ({ slot: true }) },
  });
  const result = await invoke(controller.getPaymentContext, {
    params: { id: "request-1" },
    correlationId: "corr-payment",
  });
  assert.equal(result.res.statusCode, 200);
  assert.deepEqual(profileLookup, ["mentor-1", "corr-payment"]);
  assert.equal(result.res.body.data.sessionRate, 75);
  assert.equal(result.res.body.data.sessionCount, 2);
  assert.equal(result.res.body.data.totalAmount, 150);
});

test("payment context leaves invalid pricing unchanged and reports missing records", async () => {
  let profileCalls = 0;
  const controller = createController({
    connectRequestPaymentRepository: {
      findPaymentContext: async () => ({
        mentor: "mentor-1",
        sessionRate: undefined,
        sessionCount: 0,
        selectedSlots: [],
      }),
      updatePaymentState: async () => null,
    },
    profileClient: {
      getMentorProfile: async () => {
        profileCalls += 1;
        return { hourlyRate: 0 };
      },
    },
    sessionService: { addSlot: async () => null },
  });
  const result = await invoke(controller.getPaymentContext, { params: { id: "request-1" } });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body.data.sessionRate, undefined);
  assert.equal(profileCalls, 1);
  const missing = await invoke(createController({
    connectRequestPaymentRepository: { findPaymentContext: async () => null },
    profileClient: {},
    sessionService: {},
  }).getPaymentContext, { params: { id: "missing" } });
  assert.equal(missing.res.statusCode, 404);
  assert.equal(missing.res.body.code, "CONNECT_REQUEST_NOT_FOUND");
});

test("payment state and additional slot handlers return results and handle missing requests", async () => {
  const calls = [];
  let updateResult = { status: "paid" };
  const controller = createController({
    connectRequestPaymentRepository: {
      findPaymentContext: async () => null,
      updatePaymentState: async (...args) => {
        calls.push(["update", ...args]);
        return updateResult;
      },
    },
    profileClient: {},
    sessionService: {
      addSlot: async (value) => {
        calls.push(["add", value]);
        return { created: true };
      },
    },
  });
  const updated = await invoke(controller.updatePaymentState, {
    params: { id: "request-1" },
    body: { paymentStatus: "paid" },
  });
  assert.equal(updated.res.statusCode, 200);
  assert.equal(updated.res.body.data.status, "paid");
  updateResult = null;
  const missing = await invoke(controller.updatePaymentState, {
    params: { id: "missing" },
  });
  assert.equal(missing.res.statusCode, 404);
  const slot = await invoke(controller.createAdditionalSlot, {
    params: { id: "request-1" },
    body: { date: "2026-01-01" },
    correlationId: "corr-slot",
  });
  assert.equal(slot.res.statusCode, 201);
  assert.deepEqual(calls[0], ["update", "request-1", { paymentStatus: "paid" }]);
  assert.deepEqual(calls[2], ["add", {
    connectRequestId: "request-1",
    date: "2026-01-01",
    correlationId: "corr-slot",
  }]);
});

test("payment controller forwards repository, profile, and slot service errors", async () => {
  const failure = new Error("internal payment failure");
  const controller = createController({
    connectRequestPaymentRepository: {
      findPaymentContext: async () => { throw failure; },
      updatePaymentState: async () => { throw failure; },
    },
    profileClient: {},
    sessionService: { addSlot: async () => { throw failure; } },
  });
  const req = { params: { id: "request-1" }, body: {} };
  for (const method of ["getPaymentContext", "updatePaymentState", "createAdditionalSlot"]) {
    assert.equal((await invoke(controller[method], req)).error, failure);
  }
});
