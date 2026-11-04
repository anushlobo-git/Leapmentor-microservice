const test = require("node:test");
const assert = require("node:assert/strict");

const createSessionController = require("../../controllers/session.controller");

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

test("session controller forwards all slot operations to the service", async () => {
  const calls = [];
  const methodNames = [
    "getSlots",
    "setMeetingLink",
    "markSlotComplete",
    "addSlot",
    "cancelSlot",
    "rescheduleSlot",
    "getMentorAvailability",
  ];
  const sessionService = Object.fromEntries(
    methodNames.map((method) => [
      method,
      async (...args) => {
        calls.push([method, ...args]);
        return { method };
      },
    ]),
  );
  const controller = createSessionController({ sessionService });
  const req = {
    params: { connectRequestId: "request-1", slotIndex: "2" },
    user: { _id: "user-1" },
    body: { meetingLink: "https://example.com", reason: "schedule", date: "2026-02-01" },
    query: { duration: "30" },
    correlationId: "corr-1",
  };
  const expectedStatuses = {
    getSlots: 200,
    setMeetingLink: 200,
    markSlotComplete: 200,
    addSlot: 201,
    cancelSlot: 200,
    rescheduleSlot: 200,
    getMentorAvailability: 200,
  };
  const expectedMessages = {
    getSlots: "Session slots retrieved",
    setMeetingLink: "Meeting link updated",
    markSlotComplete: "Slot marked complete",
    addSlot: "Additional session slot added successfully",
    cancelSlot: "Slot cancelled successfully",
    rescheduleSlot: "Slot rescheduled successfully",
    getMentorAvailability: "Mentor availability retrieved",
  };

  for (const method of methodNames) {
    const result = await invoke(controller[method], req);
    assert.equal(result.error, undefined);
    assert.equal(result.res.statusCode, expectedStatuses[method]);
    assert.equal(result.res.body.success, true);
    assert.deepEqual(result.res.body.data, { method });
    assert.equal(result.res.body.message, expectedMessages[method]);
  }
  assert.deepEqual(calls, [
    ["getSlots", "request-1", "user-1"],
    ["setMeetingLink", {
      connectRequestId: "request-1",
      slotIndex: "2",
      meetingLink: req.body.meetingLink,
      userId: "user-1",
    }],
    ["markSlotComplete", {
      connectRequestId: "request-1",
      slotIndex: "2",
      userId: "user-1",
      correlationId: "corr-1",
    }],
    ["addSlot", {
      connectRequestId: "request-1",
      ...req.body,
      userId: "user-1",
      correlationId: "corr-1",
    }],
    ["cancelSlot", {
      connectRequestId: "request-1",
      slotIndex: "2",
      reason: req.body.reason,
      userId: "user-1",
      correlationId: "corr-1",
    }],
    ["rescheduleSlot", {
      connectRequestId: "request-1",
      slotIndex: "2",
      ...req.body,
      userId: "user-1",
      correlationId: "corr-1",
    }],
    ["getMentorAvailability", "request-1", 30, "user-1", "corr-1"],
  ]);
});

test("session controller uses the default availability duration and forwards service errors", async () => {
  let duration;
  const controller = createSessionController({
    sessionService: {
      getMentorAvailability: async (_id, value) => {
        duration = value;
        throw new Error("availability failed");
      },
    },
  });
  const result = await invoke(controller.getMentorAvailability, {
    params: { connectRequestId: "request-1" },
    query: { duration: "invalid" },
    user: { _id: "user-1" },
  });
  assert.equal(duration, 60);
  assert.equal(result.error.message, "availability failed");
});

test("session controller forwards failures from every slot operation", async () => {
  const methods = [
    "getSlots",
    "setMeetingLink",
    "markSlotComplete",
    "addSlot",
    "cancelSlot",
    "rescheduleSlot",
    "getMentorAvailability",
  ];
  const failure = new Error("session service failed");
  const controller = createSessionController({
    sessionService: Object.fromEntries(
      methods.map((method) => [method, async () => { throw failure; }]),
    ),
  });
  const req = {
    params: { connectRequestId: "request-1", slotIndex: "0" },
    user: { _id: "user-1" },
    body: {},
    query: {},
  };
  for (const method of methods) {
    const result = await invoke(controller[method], req);
    assert.equal(result.error, failure, method);
  }
});
