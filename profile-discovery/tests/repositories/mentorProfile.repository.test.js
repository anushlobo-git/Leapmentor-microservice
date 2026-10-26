const test = require("node:test");
const assert = require("node:assert/strict");

const createMentorProfileRepository = require("../../repositories/mentorProfile.repository");

const chain = (value) => {
  const query = Promise.resolve(value);
  query.populate = (fields, projection) => {
    query.population = [fields, projection];
    return query;
  };
  query.lean = () => query;
  return query;
};

test("uses user ownership for current and published mentor profile reads", async () => {
  const currentQuery = chain({ _id: "profile-1" });
  const publicQuery = chain({ _id: "profile-1", isProfilePublished: true });
  const calls = [];
  const MentorProfile = {
    findOne: (filter) => {
      calls.push(filter);
      return calls.length === 1 ? currentQuery : publicQuery;
    },
  };
  const repository = createMentorProfileRepository(MentorProfile);

  await repository.findMentorProfileByUserIdWithUser("user-1");
  await repository.findPublishedByUserId("user-1");

  assert.deepEqual(calls, [
    { user: "user-1" },
    { user: "user-1", isProfilePublished: { $ne: false } },
  ]);
  assert.deepEqual(currentQuery.population, [
    "user",
    "name email isEmailVerified",
  ]);
  assert.deepEqual(publicQuery.population, ["user", "name email"]);
});

test("creates and atomically updates mentor profiles with validators enabled", async () => {
  const created = { _id: "profile-2" };
  const calls = [];
  const MentorProfile = {
    create: async (data) => {
      calls.push(["create", data]);
      return created;
    },
    findOneAndUpdate: async (...args) => {
      calls.push(["update", ...args]);
      return created;
    },
  };
  const repository = createMentorProfileRepository(MentorProfile);

  assert.equal(await repository.create({ user: "user-2" }), created);
  assert.equal(
    await repository.findOneAndUpdateByUserId("user-2", { bio: "Updated" }),
    created,
  );
  assert.deepEqual(calls[1], [
    "update",
    { user: "user-2" },
    { $set: { bio: "Updated" } },
    { new: true, runValidators: true },
  ]);
});
