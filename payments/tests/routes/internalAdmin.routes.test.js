const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createSettingsRouter = require("../../routes/internalSettings.routes");
const createRefundRouter = require("../../routes/internalRefund.routes");

test("internal Admin settings and refund routes require Payments internal authentication", async () => {
  const server = http.createServer(createApp({
    health: { isReady: () => true },
    internalServiceAuth: createInternalServiceAuth({ serviceToken: "payments-token" }),
    internalSettingsRouter: createSettingsRouter({ controller: {
      getCommission: (_req, res) => res.json({ route: "commission" }),
      updateCommission: (_req, res) => res.json({ route: "commission-update" }),
    } }),
    internalRefundRouter: createRefundRouter({ controller: { refund: (_req, res) => res.json({ route: "refund" }) } }),
  }));
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const unauthorized = await fetch(`${url}/internal/v1/settings/commission`);
    const authorized = await fetch(`${url}/internal/v1/settings/commission`, { headers: { Authorization: "Bearer payments-token" } });
    assert.equal(unauthorized.status, 401);
    assert.equal(authorized.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
