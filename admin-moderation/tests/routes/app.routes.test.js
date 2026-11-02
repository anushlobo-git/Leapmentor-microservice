const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createDashboardRouter = require("../../routes/dashboard.routes");

test("health, readiness, correlation ID, and protected-route behavior stay consistent", async () => {
  let ready = false;
  const server = http.createServer(
    createApp({
      health: { isReady: () => ready },
      dashboardRouter: createDashboardRouter({
        authenticate: (_req, _res, next) => next(),
        controller: {
          getStats: (_req, res) =>
            res.status(200).json({ success: true, data: { totalUsers: 5 } }),
          getUserGrowth: (_req, res) => res.sendStatus(200),
          getMentorIndustryStats: (_req, res) => res.sendStatus(200),
          getEngagementStats: (_req, res) => res.sendStatus(200),
          getEngagements: (_req, res) => res.sendStatus(200),
        },
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const liveResponse = await fetch(`${baseUrl}/health/live`);
    assert.equal(liveResponse.status, 200);
    assert.deepEqual(await liveResponse.json(), {
      status: "ok",
      service: "admin-moderation",
    });

    const readyResponse = await fetch(`${baseUrl}/health/ready`);
    assert.equal(readyResponse.status, 503);
    assert.deepEqual(await readyResponse.json(), {
      status: "not-ready",
      service: "admin-moderation",
    });

    const requestCorrelationId = "test-correlation-id";
    const rootResponse = await fetch(`${baseUrl}/`, {
      headers: { "X-Correlation-ID": requestCorrelationId },
    });
    assert.equal(rootResponse.headers.get("x-correlation-id"), requestCorrelationId);
    assert.deepEqual(await rootResponse.json(), {
      service: "admin-moderation",
      status: "running",
    });

    const unavailableResponse = await fetch(`${baseUrl}/api/v1/admin/stats`);
    assert.equal(unavailableResponse.status, 503);
    assert.equal((await unavailableResponse.json()).code, "SERVICE_NOT_READY");

    ready = true;
    const availableResponse = await fetch(`${baseUrl}/health/ready`);
    assert.equal(availableResponse.status, 200);
    assert.deepEqual(await availableResponse.json(), {
      status: "ready",
      service: "admin-moderation",
    });
    const statsResponse = await fetch(`${baseUrl}/api/v1/admin/stats`);
    assert.equal(statsResponse.status, 200);
    assert.deepEqual((await statsResponse.json()).data, { totalUsers: 5 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
