const test = require("node:test");
const assert = require("node:assert/strict");

const createMenteeProfileRepository = require("../../repositories/menteeProfile.repository");

const chain = (value) => {
  const query = Promise.resolve(value);
  query.populate = (fields, projection) => {
    query.population = [fields, projection];
    return query;
  };
  query.lean = () => query;
  return query;
};

test("uses exact publication ownership for mentee public profiles", async () => {
  const query = chain({ _id: "profile-1" });
  let filter;
  const repository = createMenteeProfileRepository({
    findOne: (value) => {
      filter = value;
      return query;
    },
  });

  await repository.findPublishedByUserId("user-1");

  assert.deepEqual(filter, { user: "user-1", isProfilePublished: true });
  assert.deepEqual(query.population, ["user", "name email"]);
});

test("creates and updates mentee profiles with validators enabled", async () => {
  const calls = [];
  const profile = { _id: "profile-2" };
  const repository = createMenteeProfileRepository({
    create: async (data) => {
      calls.push(["create", data]);
      return profile;
    },
    findOneAndUpdate: async (...args) => {
      calls.push(["update", ...args]);
      return profile;
    },
  });

  assert.equal(await repository.create({ user: "user-2" }), profile);
  assert.equal(
    await repository.findOneAndUpdateByUserId("user-2", { bio: "Updated" }),
    profile,
  );
  assert.deepEqual(calls[1], [
    "update",
    { user: "user-2" },
    { $set: { bio: "Updated" } },
    { new: true, runValidators: true },
  ]);
});
