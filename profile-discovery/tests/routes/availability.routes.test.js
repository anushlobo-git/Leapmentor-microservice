const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createAvailabilityRouter = require("../../routes/availability.routes");
const validations = require("../../middleware/availabilityValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("availability routes protect mentor writes and authenticated slot lookup", async () => {
  const calls = [];
  const router = createAvailabilityRouter({
    authenticate: (req, _res, next) => {
      req.user = { _id: "mentor-1", roles: ["mentor"] };
      next();
    },
    requireRole: (...roles) => (req, res, next) => {
      calls.push(roles);
      if (!roles.some((role) => req.user.roles.includes(role))) {
        return res.status(403).json({ code: "ROLE_REQUIRED" });
      }
      return next();
    },
    validations,
    availabilityController: {
      getMyAvailability: (_req, res) => res.status(200).json({ route: "me" }),
      createAvailability: (_req, res) => res.status(201).json({ route: "create" }),
      updateAvailability: (_req, res) => res.status(200).json({ route: "update" }),
      deleteAvailability: (_req, res) => res.status(200).json({ route: "delete" }),
      getAvailableSlots: (_req, res) => res.status(200).json({ route: "slots" }),
      getMentorAvailability: (_req, res) => res.status(200).json({ route: "public" }),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    availabilityRouter: router,
  });

  try {
    const me = await fetch(`${serverDetails.url}/api/v1/availability/me`);
    const slots = await fetch(
      `${serverDetails.url}/api/v1/availability/mentor-2/slots?duration=60`,
    );
    const publicView = await fetch(
      `${serverDetails.url}/api/v1/availability/mentor-2`,
    );
    assert.equal(me.status, 200);
    assert.equal(slots.status, 200);
    assert.equal(publicView.status, 200);
    assert.deepEqual(calls, [["mentor"]]);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
