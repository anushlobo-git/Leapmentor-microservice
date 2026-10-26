const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createGoogleCalendarRouter = require("../../routes/googleCalendar.routes");
const validations = require("../../middleware/googleCalendarValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

const passThrough = (_req, _res, next) => next();

test("Google Calendar routes expose the public callback and protect mentor operations", async () => {
  const router = createGoogleCalendarRouter({
    authenticate: (req, _res, next) => {
      req.user = { _id: "mentor-1", roles: ["mentor"] };
      next();
    },
    requireRole: (...roles) => (req, res, next) =>
      roles.some((role) => req.user.roles.includes(role))
        ? next()
        : res.status(403).json({ code: "ROLE_REQUIRED" }),
    requireReady: passThrough,
    validations,
    googleCalendarController: {
      handleCallback: (_req, res) => res.status(200).send("callback"),
      getAuthUrl: (_req, res) => res.status(200).json({ route: "auth" }),
      disconnect: (_req, res) => res.status(200).json({ route: "disconnect" }),
      getBusySlots: (_req, res) => res.status(200).json({ route: "busy" }),
      getEvents: (_req, res) => res.status(200).json({ route: "events" }),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    googleCalendarRouter: router,
  });

  try {
    const callback = await fetch(
      `${serverDetails.url}/api/v1/google-calendar/callback?error=access_denied`,
    );
    const auth = await fetch(`${serverDetails.url}/api/v1/google-calendar/auth-url`);
    const busy = await fetch(
      `${serverDetails.url}/api/v1/google-calendar/busy?startDate=2026-01-01&endDate=2026-01-02`,
    );
    assert.equal(callback.status, 200);
    assert.equal(auth.status, 200);
    assert.equal(busy.status, 200);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("calendar interval validation rejects inverted dates", () => {
  let captured;
  validations.getCalendarIntervalValidation(
    { query: { startDate: "2026-01-03", endDate: "2026-01-02" } },
    {},
    (error) => {
      captured = error;
    },
  );
  assert.equal(captured.statusCode, 400);
});
