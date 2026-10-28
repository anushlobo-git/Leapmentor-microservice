const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createInternalAdminPaymentsRouter = require("../../routes/internalAdminPayments.routes");

test("Payments admin endpoints require the internal service token", async () => {
  const server = http.createServer(createApp({
    health: { isReady: () => true },
    internalServiceAuth: createInternalServiceAuth({ serviceToken: "payments-token" }),
    internalAdminPaymentsRouter: createInternalAdminPaymentsRouter({ controller: {
      getSummary: (_req, res) => res.json({ data: { commissionRate: 20 } }),
      getTransactions: (_req, res) => res.json({ data: { transactions: [] } }),
    } }),
  }));
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/internal/v1/admin/payments/summary`;
    const unauthorized = await fetch(baseUrl);
    const authorized = await fetch(baseUrl, { headers: { Authorization: "Bearer payments-token" } });
    assert.equal(unauthorized.status, 401);
    assert.equal(authorized.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});