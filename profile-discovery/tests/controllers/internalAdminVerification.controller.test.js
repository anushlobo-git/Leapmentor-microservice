const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/internalAdminVerification.controller");

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("verification queues the mentor-verified email after saving the status", async () => {
  const profile = {
    _id: "507f1f77bcf86cd799439011",
    user: "507f1f77bcf86cd799439012",
    verificationStatus: "pending",
  };
  const events = [];
  let saved = false;
  const controller = createController({
    mentorProfileRepository: {
      findMentorProfileByIdForAdminMutable: async () => profile,
      saveMentorProfile: async () => {
        saved = true;
      },
    },
    identityClient: {
      getUserSummaries: async () => [
        {
          name: "Mentor One",
          email: "mentor@example.com",
        },
      ],
    },
    workspaceClient: {
      queueEmailEvent: async (event) => {
        assert.equal(saved, true);
        events.push(event);
      },
    },
  });
  const res = createResponse();

  await controller.verify(
    {
      params: { mentorProfileId: profile._id },
      correlationId: "corr-verify",
    },
    res,
    assert.fail,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(events[0], {
    eventType: "profile.mentor-verified.email",
    sourceEventId: `profile-mentor-verified:${profile._id}`,
    mentorName: "Mentor One",
    mentorEmail: "mentor@example.com",
  });
});
