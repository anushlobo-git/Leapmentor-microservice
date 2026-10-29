const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createRatingController = require("../../controllers/internalMentorRating.controller");
const createRatingRouter = require("../../routes/internalMentorRating.routes");
const createLookupController = require("../../controllers/internalMentorLookup.controller");
const createLookupRouter = require("../../routes/internalMentorLookup.routes");

const startServer = async () => {
  const updatedRatings = [];
  const availabilityCalls = [];
  const internalServiceAuth = createInternalServiceAuth({
    serviceToken: "profile-token",
    routeScopes: { "/internal/v1/mentors": ["workspace-token"] },
  });
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      internalServiceAuth,
      internalMentorRatingRouter: createRatingRouter({
        controller: createRatingController({
          mentorProfileRepository: {
            findMentorProfileByUserId: async () => ({ avgRating: 4.2 }),
            updateAverageRating: async (_userId, avgRating) => {
              updatedRatings.push(avgRating);
              return { avgRating };
            },
          },
        }),
        validate: (_req, _res, next) => next(),
      }),
      internalMentorLookupRouter: createLookupRouter({
        controller: createLookupController({
          mentorProfileRepository: {
            findMentorProfileByUserId: async () => ({ skills: [] }),
          },
          identityClient: { getUserSummaries: async () => [] },
          availabilityService: {
            getAvailableSlots: async (...args) => {
              availabilityCalls.push(args);
              return {
                timezone: "Asia/Kolkata",
                sessionDurations: [30, 60],
                slots: [],
              };
            },
          },
          toMentorSearchDTO: (profile) => profile,
        }),
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, updatedRatings, availabilityCalls };
};

test("mentor rating internal route enforces Workspace scope and preserves rating contract", async () => {
  const setup = await startServer();
  const baseUrl = `http://127.0.0.1:${setup.server.address().port}`;
  try {
    const rejected = await fetch(
      `${baseUrl}/internal/v1/mentors/user-1/rating`,
      {
        headers: { Authorization: "Bearer profile-token" },
      },
    );
    assert.equal(rejected.status, 401);

    const read = await fetch(`${baseUrl}/internal/v1/mentors/user-1/rating`, {
      headers: { Authorization: "Bearer workspace-token" },
    });
    assert.equal(read.status, 200);
    assert.equal((await read.json()).data.avgRating, 4.2);

    const updated = await fetch(
      `${baseUrl}/internal/v1/mentors/user-1/rating`,
      {
        method: "PUT",
        headers: {
          Authorization: "Bearer workspace-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avgRating: 4.7 }),
      },
    );
    assert.equal(updated.status, 200);
    assert.deepEqual(setup.updatedRatings, [4.7]);
  } finally {
    await new Promise((resolve) => setup.server.close(resolve));
  }
});

test("mentor lookup route forwards request ID for session reschedule availability", async () => {
  const setup = await startServer();
  const baseUrl = `http://127.0.0.1:${setup.server.address().port}`;
  try {
    const response = await fetch(
      `${baseUrl}/internal/v1/mentors/mentor-1/availability?duration=45&excludeUserId=mentee-1&requestId=request-1`,
      { headers: { Authorization: "Bearer workspace-token" } },
    );
    assert.equal(response.status, 200);
    assert.equal(setup.availabilityCalls[0][0], "mentor-1");
    assert.equal(setup.availabilityCalls[0][1], 45);
    assert.equal(setup.availabilityCalls[0][2], "mentee-1");
    assert.equal(
      setup.availabilityCalls[0][3].rescheduleRequestId,
      "request-1",
    );
    assert.ok(setup.availabilityCalls[0][3].correlationId);
    assert.deepEqual((await response.json()).data.slots, []);
  } finally {
    await new Promise((resolve) => setup.server.close(resolve));
  }
});
