const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createAuth = require("../../middleware/internalServiceAuth");
const createRouter = require("../../routes/internalAvailability.routes");

test("protects the internal blocker route with the Workspace service token", async () => {
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      internalServiceAuth: createAuth({ serviceToken: "profile-token" }),
      internalAvailabilityRouter: createRouter({
        internalAvailabilityController: {
          getBlockers: (_req, res) => res.status(200).json({ ok: true }),
        },
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const unauthorized = await fetch(`${url}/internal/v1/availability/blockers/mentor-1`);
    const authorized = await fetch(
      `${url}/internal/v1/availability/blockers/mentor-1`,
      { headers: { Authorization: "Bearer profile-token" } },
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(authorized.status, 200);
    assert.deepEqual(await authorized.json(), { ok: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
