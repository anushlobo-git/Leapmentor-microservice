const http = require("node:http");
const express = require("express");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");

const routerFor = (path) => {
  const router = express.Router();
  router.get(path, (_req, res) => res.json({ mounted: path }));
  return router;
};

test("app mounts each configured public and internal route group", async () => {
  const app = createApp({
    health: { isReady: () => true },
    authController: { logout: (_req, res) => res.status(200).json({ loggedOut: true }) },
    oauthPublicRouter: routerFor("/oauth-test"),
    internalServiceAuth: (_req, _res, next) => next(),
    internalAdminServiceAuth: (_req, _res, next) => next(),
    internalUserRouter: routerFor("/internal-test"),
    internalAdminUserRouter: routerFor("/internal-test"),
    internalAdminStatsRouter: routerFor("/stats-test"),
    authRouter: routerFor("/auth-test"),
    verificationRouter: routerFor("/verification-test"),
    forgotPasswordRouter: routerFor("/forgot-test"),
    userRouter: routerFor("/user-test"),
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const paths = [
      ["/api/v1/auth/logout", "POST"],
      ["/api/v1/auth/oauth-test", "GET"],
      ["/internal/v1/users/internal-test", "GET"],
      ["/internal/v1/admin/users/internal-test", "GET"],
      ["/internal/v1/admin/stats-test", "GET"],
      ["/api/v1/auth/auth-test", "GET"],
      ["/api/v1/verification/verification-test", "GET"],
      ["/api/v1/auth/forgot-test", "GET"],
      ["/api/v1/users/user-test", "GET"],
    ];

    for (const [path, method] of paths) {
      const response = await fetch(`${baseUrl}${path}`, { method });
      assert.equal(response.status, 200, path);
    }

    const correlated = await fetch(`${baseUrl}/api/v1/auth/oauth-test`, {
      headers: { "X-Correlation-ID": "caller-correlation" },
    });
    assert.equal(correlated.headers.get("x-correlation-id"), "caller-correlation");
    assert.deepEqual(await correlated.json(), { mounted: "/oauth-test" });
    assert.deepEqual(await (await fetch(`${baseUrl}/api/v1/auth/logout`, { method: "POST" })).json(), {
      loggedOut: true,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("app health endpoints report live state and persistence readiness", async () => {
  const server = http.createServer(createApp({ health: { isReady: () => false } }));
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const live = await fetch(`${baseUrl}/health/live`);
    assert.equal(live.status, 200);
    assert.equal((await live.json()).status, "ok");
    const ready = await fetch(`${baseUrl}/health/ready`);
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).status, "not-ready");
    assert.deepEqual(await (await fetch(`${baseUrl}/`)).json(), {
      service: "identity-access",
      status: "running",
    });
    assert.equal((await fetch(`${baseUrl}/api/v1/auth/logout`, { method: "POST" })).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
