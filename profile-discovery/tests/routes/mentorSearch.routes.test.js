const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createMentorSearchRouter = require("../../routes/mentorSearch.routes");
const { searchMentorsValidation } = require("../../middleware/mentorSearchValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("mentor search requires a mentee and returns the discovery payload", async () => {
  const router = createMentorSearchRouter({
    authenticate: (req, _res, next) => {
      req.user = { _id: "user-1", roles: ["mentee"] };
      next();
    },
    requireRole: (...roles) => (req, res, next) =>
      roles.some((role) => req.user.roles.includes(role))
        ? next()
        : res.status(403).json({ code: "ROLE_REQUIRED" }),
    validations: { searchMentorsValidation },
    mentorSearchController: {
      searchMentors: (_req, res) =>
        res.status(200).json({ success: true, data: { mentors: [] } }),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    mentorSearchRouter: router,
  });

  try {
    const response = await fetch(
      `${serverDetails.url}/api/v1/mentors/search?skill=react&limit=6`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { mentors: [] });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("mentor search validation rejects unsupported query fields", async () => {
  let captured;
  searchMentorsValidation({ query: { unsupported: "value" } }, {}, (error) => {
    captured = error;
  });

  assert.equal(captured.statusCode, 400);
  assert.equal(captured.code, "INVALID_MENTOR_SEARCH");
});
