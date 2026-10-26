const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createMenteeProfileRouter = require("../../routes/menteeProfile.routes");
const validations = require("../../middleware/menteeProfileValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("mentee profile routes enforce role middleware and preserve public lookup", async () => {
  const calls = [];
  const router = createMenteeProfileRouter({
    authenticate: (req, _res, next) => {
      req.user = { _id: "user-1", roles: ["mentee"] };
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
    menteeProfileController: {
      getMyProfile: (_req, res) => res.status(200).json({ route: "me" }),
      updateProfile: (_req, res) => res.status(200).json({ route: "update" }),
      createProfile: (_req, res) => res.status(201).json({ route: "create" }),
      getPublicProfile: (req, res) => res.status(200).json({ id: req.params.id }),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    menteeProfileRouter: router,
  });

  try {
    const me = await fetch(`${serverDetails.url}/api/v1/mentee-profile/me`);
    const publicProfile = await fetch(
      `${serverDetails.url}/api/v1/mentee-profile/507f1f77bcf86cd799439011`,
    );
    assert.equal(me.status, 200);
    assert.equal((await me.json()).route, "me");
    assert.equal(publicProfile.status, 200);
    assert.equal((await publicProfile.json()).id, "507f1f77bcf86cd799439011");
    assert.deepEqual(calls, [["mentee"]]);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
