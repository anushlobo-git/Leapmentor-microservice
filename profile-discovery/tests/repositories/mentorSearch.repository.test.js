const test = require("node:test");
const assert = require("node:assert/strict");

const createMentorSearchRepository = require("../../repositories/mentorSearch.repository");

const createQuery = (value) => {
  const query = Promise.resolve(value);
  query.select = (...args) => {
    query.selected = args;
    return query;
  };
  query.sort = (...args) => {
    query.sorted = args;
    return query;
  };
  query.skip = (...args) => {
    query.skipped = args;
    return query;
  };
  query.limit = (...args) => {
    query.limited = args;
    return query;
  };
  query.lean = () => query;
  return query;
};

test("search repository counts and paginates only the requested public fields", async () => {
  const query = createQuery([{ _id: "profile-1", user: "user-1" }]);
  const calls = [];
  const MentorProfile = {
    countDocuments: async (filter) => {
      calls.push(["count", filter]);
      return 1;
    },
    find: (filter) => {
      calls.push(["find", filter]);
      return query;
    },
  };
  const repository = createMentorSearchRepository(MentorProfile);
  const filter = { isProfileComplete: true };

  assert.equal(await repository.countSearchable(filter), 1);
  assert.deepEqual(
    await repository.findSearchable(filter, { skip: 6, limit: 6 }),
    [{ _id: "profile-1", user: "user-1" }],
  );
  assert.deepEqual(calls, [
    ["count", filter],
    ["find", filter],
  ]);
  assert.deepEqual(query.sorted, [{ avgRating: -1, totalSessions: -1, _id: 1 }]);
  assert.deepEqual(query.skipped, [6]);
  assert.deepEqual(query.limited, [6]);
  assert.doesNotMatch(
    query.selected[0],
    /resumeDocument|workExperienceDocuments|phoneNumber/,
    "private documents and phone number must not be selected",
  );
});
