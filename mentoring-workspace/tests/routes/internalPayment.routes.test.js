const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalPaymentController = require("../../controllers/internalPayment.controller");
const createInternalPaymentRouter = require("../../routes/internalPayment.routes");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("Workspace payment context route requires the Payments service token", async () => {
  const createdSlots = [];
  const controller = createInternalPaymentController({
    connectRequestPaymentRepository: {
      findPaymentContext: async () => ({
        _id: "request-1",
        mentor: "mentor-1",
        sessionCount: 1,
        sessionRate: null,
        totalAmount: null,
        selectedSlots: [{ date: "2099-01-01" }],
      }),
      updatePaymentState: async () => ({ _id: "request-1" }),
    },
    profileClient: {
      getMentorProfile: async () => ({ hourlyRate: 125 }),
    },
    sessionService: {
      addSlot: async (slot) => {
        createdSlots.push(slot);
        return { slotId: "slot-2", slot: slot };
      },
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    internalServiceAuth: createInternalServiceAuth({ serviceToken: "payments-token" }),
    internalPaymentRouter: createInternalPaymentRouter({ internalPaymentController: controller }),
  });

  try {
    const unauthorized = await fetch(
      `${serverDetails.url}/internal/v1/connect-requests/request-1/payment-context`,
    );
    assert.equal(unauthorized.status, 401);

    const response = await fetch(
      `${serverDetails.url}/internal/v1/connect-requests/request-1/payment-context`,
      { headers: { Authorization: "Bearer payments-token" } },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.sessionRate, 125);
    assert.equal(body.data.totalAmount, 125);

    const createUnauthorized = await fetch(
      `${serverDetails.url}/internal/v1/connect-requests/request-1/additional-slots`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    assert.equal(createUnauthorized.status, 401);

    const createResponse = await fetch(
      `${serverDetails.url}/internal/v1/connect-requests/request-1/additional-slots`,
      {
        method: "POST",
        headers: {
          Authorization: "******",
          "Content-Type": "application/json",
          ...{ Authorization: "Bearer payments-token" },
        },
        body: JSON.stringify({
          userId: "mentee-1",
          day: "Monday",
          date: "2099-01-03",
          startTime: "14:00",
          endTime: "15:00",
        }),
      },
    );
    const createBody = await createResponse.json();
    assert.equal(createResponse.status, 201, JSON.stringify(createBody));
    assert.equal(createdSlots[0].connectRequestId, "request-1");
    assert.equal(createdSlots[0].userId, "mentee-1");
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
