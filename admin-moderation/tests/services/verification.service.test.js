const test = require("node:test");
const assert = require("node:assert/strict");

const createVerificationService = require("../../services/verification.service");

const profile = {
  _id: "profile-1",
  user: { _id: "user-1", name: "Shama", email: "shama@example.com" },
  currentRole: "Engineer",
  company: "Example Co",
  verificationStatus: "pending",
};

test("normalizes flat Profile responses to the legacy admin verification shape", async () => {
  const service = createVerificationService({
    profileClient: {
      listMentorVerifications: async () => ({
        data: { mentors: [profile], total: 1 },
      }),
      getMentorVerification: async () => ({
        data: { mentor: profile },
      }),
      verifyMentor: async () => ({
        data: { mentorProfileId: "profile-1", verificationStatus: "verified" },
      }),
      revokeMentor: async () => ({
        data: { mentorProfileId: "profile-1", verificationStatus: "unverified" },
      }),
    },
  });

  const listed = await service.list("corr-1");
  assert.equal(listed.mentors[0].user._id, "user-1");
  assert.equal(listed.mentors[0].mentorProfile._id, "profile-1");
  assert.equal(listed.mentors[0].mentorProfile.company, "Example Co");

  const detail = await service.getById("profile-1", "corr-1");
  assert.equal(detail.mentor.mentorProfile._id, "profile-1");
  assert.equal(detail.mentor.user.email, "shama@example.com");

  assert.deepEqual(await service.verify("profile-1", "corr-1"), {
    mentorProfileId: "profile-1",
    verificationStatus: "verified",
  });
});

test("preserves already-normalized verification responses", async () => {
  const normalized = {
    user: { _id: "user-1" },
    mentorProfile: { _id: "profile-1", verificationStatus: "pending" },
  };
  const service = createVerificationService({
    profileClient: {
      listMentorVerifications: async () => ({
        data: { mentors: [normalized], total: 1 },
      }),
    },
  });

  const result = await service.list();
  assert.deepEqual(result.mentors[0], normalized);
});

test("verification service handles empty, null, and already wrapped response shapes", async () => {
  const service = createVerificationService({
    profileClient: {
      listMentorVerifications: async () => ({ data: { mentors: [null, profile] } }),
      getMentorVerification: async (id) => {
        if (id === "missing") return {};
        if (id === "wrapped") return { data: { mentor: null, total: 0 } };
        return { data: profile };
      },
      verifyMentor: async () => ({}),
      revokeMentor: async () => ({ data: null }),
    },
  });

  assert.deepEqual(await service.list(), {
    mentors: [{ user: profile.user, mentorProfile: {
      _id: profile._id,
      currentRole: profile.currentRole,
      company: profile.company,
      verificationStatus: profile.verificationStatus,
    } }],
    total: 1,
  });
  assert.equal(await service.getById("missing"), null);
  assert.deepEqual(await service.getById("wrapped"), {
    user: undefined,
    mentorProfile: { mentor: null, total: 0 },
  });
  assert.deepEqual((await service.getById("flat")).mentorProfile, {
    _id: profile._id,
    currentRole: profile.currentRole,
    company: profile.company,
    verificationStatus: profile.verificationStatus,
  });
  assert.equal(await service.verify("profile-1"), null);
  assert.equal(await service.revoke("profile-1"), null);
});
