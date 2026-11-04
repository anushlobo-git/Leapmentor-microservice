const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const createApp = require("../app");

const request = async (server, path, headers) => {
  const { port } = server.address();
  return fetch(`http://127.0.0.1:${port}${path}`, { headers });
};

const start = async (app) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return server;
};

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

test("health endpoints, root response, correlation IDs, and readiness states", async () => {
  const server = await start(createApp());
  try {
    const live = await request(server, "/health/live");
    assert.equal(live.status, 200);
    assert.equal((await live.json()).status, "ok");
    assert.ok(live.headers.get("x-correlation-id"));

    const suppliedId = await request(server, "/", { "X-Correlation-ID": "corr-app" });
    assert.equal(suppliedId.headers.get("x-correlation-id"), "corr-app");
    assert.equal((await suppliedId.json()).status, "running");

    const notReady = await request(server, "/health/ready");
    assert.equal(notReady.status, 503);
    assert.equal((await notReady.json()).status, "not-ready");
  } finally {
    await close(server);
  }

  const readyServer = await start(createApp({ health: { isReady: () => true } }));
  try {
    const ready = await request(readyServer, "/health/ready");
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).status, "ready");
  } finally {
    await close(readyServer);
  }
});

test("mounts each internal and public router behind its expected prefix", async () => {
  const routerNames = {
    internalAvailabilityRouter: "/internal/v1/availability",
    internalPaymentRouter: "/internal/v1/connect-requests",
    internalFinanceRouter: "/internal/v1/finance",
    internalReminderRouter: "/internal/v1/reminders",
    internalAdminUserRouter: "/internal/v1/admin/users",
    internalAdminStatsRouter: "/internal/v1/admin",
    internalAdminPaymentsRouter: "/internal/v1/admin/payments",
    internalAdminReportsRouter: "/internal/v1/admin/reports",
    connectRequestRouter: "/api/v1/connect-requests",
    slotLockRouter: "/api/v1/slot-locks",
    sessionRouter: "/api/v1/sessions",
    messageRouter: "/api/v1/messages",
    goalRouter: "/api/v1/goals",
    feedbackRouter: "/api/v1/feedback",
    reportRouter: "/api/v1/reports",
    privateNoteRouter: "/api/v1/private-notes",
    noteRouter: "/api/v1/notes",
  };
  const container = {
    health: { isReady: () => true },
    internalServiceAuth: (_req, _res, next) => next(),
    internalAdminServiceAuth: (_req, _res, next) => next(),
  };
  for (const name of Object.keys(routerNames)) {
    const router = express.Router();
    router.get("/probe", (_req, res) => res.json({ router: name }));
    container[name] = router;
  }
  const server = await start(createApp(container));
  try {
    for (const [name, prefix] of Object.entries(routerNames)) {
      const response = await request(server, `${prefix}/probe`);
      assert.equal(response.status, 200, prefix);
      assert.deepEqual(await response.json(), { router: name }, prefix);
    }
  } finally {
    await close(server);
  }
});

test("does not mount an internal router without its service authentication middleware", async () => {
  const router = express.Router();
  router.get("/probe", (_req, res) => res.json({ mounted: true }));
  const server = await start(createApp({ internalAvailabilityRouter: router }));
  try {
    const response = await request(server, "/internal/v1/availability/probe");
    assert.equal(response.status, 404);
  } finally {
    await close(server);
  }
});
