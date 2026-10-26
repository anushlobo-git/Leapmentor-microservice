const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createRouter = require("../../routes/internalAdminVerification.routes");

test("internal mentor verification routes require the Admin service token", async () => {
  const router = createRouter({
    controller: {
      list: (_req, res) => res.json({ route: "list" }),
      getById: (_req, res) => res.json({ route: "detail" }),
      verify: (_req, res) => res.json({ route: "verify" }),
      revoke: (_req, res) => res.json({ route: "revoke" }),
    },
  });
  const server = http.createServer(createApp({
    health: { isReady: () => true },
    internalAdminServiceAuth: createInternalServiceAuth({ serviceToken: "admin-token" }),
    internalAdminVerificationRouter: router,
  }));
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const unauthorized = await fetch(`${url}/internal/v1/admin/mentor-verifications`);
    const authorized = await fetch(`${url}/internal/v1/admin/mentor-verifications`, { headers: { Authorization: "Bearer admin-token" } });
    assert.equal(unauthorized.status, 401);
    assert.equal(authorized.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
