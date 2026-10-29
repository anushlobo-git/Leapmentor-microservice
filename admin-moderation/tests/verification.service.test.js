const test = require("node:test");
const assert = require("node:assert/strict");

const createVerificationService = require("../services/verification.service");

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
