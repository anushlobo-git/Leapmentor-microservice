const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createInternalAdminPaymentsRouter = require("../../routes/internalAdminPayments.routes");

test("Workspace payment stats are available only to the Admin service token", async () => {
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      internalAdminServiceAuth: createInternalServiceAuth({
        serviceToken: "admin-token",
      }),
      internalAdminPaymentsRouter: createInternalAdminPaymentsRouter({
        controller: {
          getStats: (_req, res) =>
            res.json({ success: true, data: { totalRevenue: 12 } }),
          getChart: (_req, res) => res.json({ success: true, data: [] }),
        },
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const path = `http://127.0.0.1:${server.address().port}/internal/v1/admin/payments/stats`;
    const unauthorized = await fetch(path);
    const authorized = await fetch(path, {
      headers: { Authorization: "Bearer admin-token" },
    });
    assert.equal(unauthorized.status, 401);
    assert.equal(authorized.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
