const test = require("node:test");
const assert = require("node:assert/strict");

const createMentorProfileService = require("../../services/mentorProfile.service");

const createFakes = () => {
  const profiles = [];
  const identityUsers = new Map();
  let nextId = 1;
  const repository = {
    findMentorProfileByUserId: async (userId) =>
      profiles.find((profile) => profile.user === userId) || null,
    findMentorProfileByUserIdWithUser: async (userId) =>
      profiles.find((profile) => profile.user === userId) || null,
    findPublishedByUserId: async (userId) =>
      profiles.find(
        (profile) => profile.user === userId && profile.isProfilePublished !== false,
      ) || null,
    create: async (data) => {
      const profile = { _id: `profile-${nextId++}`, ...data };
      profiles.push(profile);
      return profile;
    },
    findOneAndUpdateByUserId: async (userId, updateData) => {
      const profile = profiles.find((candidate) => candidate.user === userId);
      if (!profile) return null;
      Object.assign(profile, updateData);
      return profile;
    },
  };
  return {
    profiles,
    identityUsers,
    repository,
    mentorProfileRepository: repository,
    identityClient: {
      getUserSummary: async (userId) => identityUsers.get(userId) || null,
    },
    toMentorProfileDTO: (profile) => ({ dto: true, ...profile }),
  };
};

test("creates a mentor profile with defaults after confirming the mentor role", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-1", { _id: "user-1", roles: ["mentor"] });
  const service = createMentorProfileService(fakes);

  const result = await service.createProfile(
    "user-1",
    {
      currentRole: "Engineer",
      industry: "Technology",
      bio: "Builds reliable systems.",
      skills: ["Node.js"],
    },
    { correlationId: "corr-profile-1" },
  );

  assert.equal(result.dto, true);
  assert.equal(result.user, "user-1");
  assert.equal(result.languages[0], "English");
  assert.equal(result.isProfileComplete, true);
  assert.equal(result.isProfilePublished, true);
});

test("rejects profile writes for accounts without the mentor role", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-2", { _id: "user-2", roles: ["mentee"] });
  const service = createMentorProfileService(fakes);

  await assert.rejects(
    () =>
      service.createProfile("user-2", {
        currentRole: "Engineer",
        industry: "Technology",
        bio: "Bio",
        skills: ["Node.js"],
      }),
    { statusCode: 403, code: "ROLE_REQUIRED" },
  );
  assert.equal(fakes.profiles.length, 0);
});

test("prevents a second profile for the same mentor account", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-3", { _id: "user-3", roles: ["mentor"] });
  fakes.profiles.push({ user: "user-3", isProfilePublished: true });
  const service = createMentorProfileService(fakes);

  await assert.rejects(
    () => service.createProfile("user-3", {}),
    { statusCode: 409, code: "PROFILE_EXISTS" },
  );
});

test("reads, updates, and publicly reads mentor profiles through the repository boundary", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-4", { _id: "user-4", roles: ["mentor"] });
  fakes.profiles.push({
    _id: "profile-4",
    user: "user-4",
    bio: "Old bio",
    isProfilePublished: true,
  });
  const service = createMentorProfileService(fakes);

  const current = await service.getMyProfile("user-4");
  const updated = await service.updateMyProfile("user-4", { bio: "New bio" });
  const publicProfile = await service.getPublicProfile("user-4");

  assert.equal(current.bio, "Old bio");
  assert.equal(updated.bio, "New bio");
  assert.equal(publicProfile.bio, "New bio");
});

test("does not allow profile updates to change ownership or moderation fields", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-6", { _id: "user-6", roles: ["mentor"] });
  fakes.profiles.push({
    _id: "profile-6",
    user: "user-6",
    isProfilePublished: true,
  });
  const service = createMentorProfileService(fakes);

  await service.updateMyProfile("user-6", {
    bio: "Safe update",
    user: "another-user",
    verificationStatus: "verified",
    isProfilePublished: false,
  });

  assert.equal(fakes.profiles[0].bio, "Safe update");
  assert.equal(fakes.profiles[0].user, "user-6");
  assert.equal(fakes.profiles[0].verificationStatus, undefined);
  assert.equal(fakes.profiles[0].isProfilePublished, true);
});

test("returns 404 when a mentor profile is missing", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-5", { _id: "user-5", roles: ["mentor"] });
  const service = createMentorProfileService(fakes);

  await assert.rejects(
    () => service.getMyProfile("user-5"),
    { statusCode: 404, code: "PROFILE_NOT_FOUND" },
  );
  await assert.rejects(
    () => service.getPublicProfile("user-5"),
    { statusCode: 404, code: "PROFILE_NOT_FOUND" },
  );
});
