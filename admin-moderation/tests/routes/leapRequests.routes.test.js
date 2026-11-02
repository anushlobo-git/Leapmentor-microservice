const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createLeapRequestsRouter = require("../../routes/leapRequests.routes");

test("preserves the admin UI Leap Request route paths behind authentication", async () => {
  const authenticate = (req, _res, next) => {
    req.admin = { _id: "admin-1" };
    next();
  };
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      leapRequestsRouter: createLeapRequestsRouter({
        authenticate,
        controller: {
          getRequests: (_req, res) => res.json({ data: { requests: [] } }),
          getPendingCount: (_req, res) => res.json({ data: { count: 2 } }),
          approve: (_req, res) => res.json({ data: { newBalance: 500 } }),
          reject: (_req, res) => res.json({ data: { request: {} } }),
        },
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const list = await fetch(`${baseUrl}/api/v1/leap-requests`);
    const count = await fetch(
      `${baseUrl}/api/v1/admin/leap-requests/pending-count`,
    );
    assert.equal(list.status, 200);
    assert.equal(count.status, 200);
    assert.equal((await count.json()).data.count, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
