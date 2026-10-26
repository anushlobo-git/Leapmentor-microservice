const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createEscrowController = require("../../controllers/escrow.controller");
const createEscrowRouter = require("../../routes/escrow.routes");
const createAuthenticate = require("../../middleware/authenticate");
const validations = require("../../middleware/escrowValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("escrow payment route authenticates the browser and preserves the payment payload", async () => {
  const calls = [];
  const controller = createEscrowController({
    escrowService: {
      pay: async (input) => {
        calls.push(input);
        return { paymentStatus: "paid" };
      },
      payAdditional: async () => ({}),
      release: async () => ({}),
      refund: async () => ({}),
      getStatus: async () => ({}),
    },
  });
  const router = createEscrowRouter({
    escrowController: controller,
    authenticate: createAuthenticate({ accessSecret: "test-secret" }),
    validations,
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    escrowRouter: router,
  });

  try {
    const token = jwt.sign({ id: "mentee-1", type: "access" }, "test-secret");
    const response = await fetch(`${serverDetails.url}/api/v1/escrow/pay`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connectRequestId: "507f1f77bcf86cd799439011",
        sessionRate: 100,
        sessionCount: 2,
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(calls[0].menteeId, "mentee-1");
    assert.equal(calls[0].sessionRate, 100);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
