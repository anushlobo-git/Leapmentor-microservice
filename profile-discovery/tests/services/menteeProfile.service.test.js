const test = require("node:test");
const assert = require("node:assert/strict");

const createMenteeProfileService = require("../../services/menteeProfile.service");

const createFakes = () => {
  const profiles = [];
  const identityUsers = new Map();
  let nextId = 1;
  const repository = {
    findByUserId: async (userId) =>
      profiles.find((profile) => profile.user === userId) || null,
    findByUserIdWithAccountInfo: async (userId) =>
      profiles.find((profile) => profile.user === userId) || null,
    findPublishedByUserId: async (userId) =>
      profiles.find(
        (profile) => profile.user === userId && profile.isProfilePublished === true,
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
    menteeProfileRepository: repository,
    identityClient: {
      getUserSummary: async (userId) => identityUsers.get(userId) || null,
    },
    toMenteeProfileDTO: (profile) => ({ dto: true, ...profile }),
  };
};

test("creates a mentee profile with defaults after confirming the mentee role", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-1", { _id: "user-1", roles: ["mentee"] });
  const service = createMenteeProfileService(fakes);

  const result = await service.createProfile(
    "user-1",
    {
      currentRole: "Student",
      industry: "Technology",
      bio: "Learning backend engineering.",
      skills: ["JavaScript"],
      interestedFields: ["Backend Engineering"],
    },
    { correlationId: "corr-mentee-1" },
  );

  assert.equal(result.dto, true);
  assert.equal(result.isProfileComplete, true);
  assert.equal(result.isProfilePublished, true);
  assert.deepEqual(result.languages, ["English"]);
});

test("rejects mentee profile writes for accounts without the mentee role", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-2", { _id: "user-2", roles: ["mentor"] });
  const service = createMenteeProfileService(fakes);

  await assert.rejects(
    () =>
      service.createProfile("user-2", {
        currentRole: "Student",
        industry: "Technology",
        bio: "Bio",
        skills: ["JavaScript"],
        interestedFields: ["Backend"],
      }),
    { statusCode: 403, code: "ROLE_REQUIRED" },
  );
  assert.equal(fakes.profiles.length, 0);
});

test("reads, updates, and publicly reads published mentee profiles", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-3", { _id: "user-3", roles: ["mentee"] });
  fakes.profiles.push({
    _id: "profile-3",
    user: "user-3",
    bio: "Old bio",
    isProfilePublished: true,
    marketingPreferences: false,
  });
  const service = createMenteeProfileService(fakes);

  const current = await service.getMyProfile("user-3");
  const updated = await service.updateMyProfile("user-3", {
    bio: "New bio",
    emailNotifications: false,
    marketingPreferences: true,
  });
  const publicProfile = await service.getPublicProfile("user-3");

  assert.equal(current.bio, "Old bio");
  assert.equal(updated.bio, "New bio");
  assert.equal(updated.emailNotifications, false);
  assert.equal(updated.marketingPreferences, true);
  assert.equal(publicProfile.bio, "New bio");
});

test("does not allow mentee updates to change ownership or publication state", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-4", { _id: "user-4", roles: ["mentee"] });
  fakes.profiles.push({
    _id: "profile-4",
    user: "user-4",
    isProfilePublished: true,
  });
  const service = createMenteeProfileService(fakes);

  await service.updateMyProfile("user-4", {
    bio: "Safe",
    user: "another-user",
    isProfilePublished: false,
  });

  assert.equal(fakes.profiles[0].user, "user-4");
  assert.equal(fakes.profiles[0].isProfilePublished, true);
});

test("returns 404 when the mentee profile is missing or unpublished", async () => {
  const fakes = createFakes();
  fakes.identityUsers.set("user-5", { _id: "user-5", roles: ["mentee"] });
  fakes.identityUsers.set("user-6", { _id: "user-6", roles: ["mentee"] });
  fakes.profiles.push({ user: "user-5", isProfilePublished: false });
  const service = createMenteeProfileService(fakes);

  await assert.rejects(
    () => service.getMyProfile("user-6"),
    { statusCode: 404, code: "PROFILE_NOT_FOUND" },
  );
  await assert.rejects(
    () => service.getPublicProfile("user-5"),
    { statusCode: 404, code: "PROFILE_NOT_FOUND" },
  );
});
