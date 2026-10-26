const test = require("node:test");
const assert = require("node:assert/strict");

const createMentorSearchService = require("../../services/mentorSearch.service");

const createService = (overrides = {}) => {
  const calls = { searchUsers: [], getUserSummaries: [] };
  const repository = {
    countSearchable: async () => 2,
    findSearchable: async () => [
      {
        _id: "profile-1",
        user: "user-1",
        skills: ["React"],
        isProfileComplete: true,
        isProfilePublished: true,
      },
    ],
    ...overrides.repository,
  };
  const identityClient = {
    searchUsers: async (query, correlationId) => {
      calls.searchUsers.push([query, correlationId]);
      return [{ _id: "user-2", name: "Grace", roles: ["mentor"] }];
    },
    getUserSummaries: async (ids, correlationId) => {
      calls.getUserSummaries.push([ids, correlationId]);
      return [{ _id: "user-1", name: "Ada", email: "ada@example.com" }];
    },
    ...overrides.identityClient,
  };
  const service = createMentorSearchService({
    mentorSearchRepository: repository,
    identityClient,
    toMentorSearchDTO: (profile, user) => ({ profile, user }),
  });
  return { service, calls };
};

test("returns paginated public mentor results and batches user summaries", async () => {
  const { service, calls } = createService();

  const result = await service.queryMentors(
    { skill: "React", page: "2", limit: "6" },
    { correlationId: "corr-1" },
  );

  assert.equal(result.mentors.length, 1);
  assert.deepEqual(result.mentors[0].user, {
    _id: "user-1",
    name: "Ada",
    email: "ada@example.com",
  });
  assert.deepEqual(calls.getUserSummaries, [[['user-1'], "corr-1"]]);
  assert.equal(result.pagination.page, 2);
  assert.equal(result.pagination.totalPages, 1);
  assert.equal(result.pagination.hasMore, false);
});

test("uses Identity name matches as an OR branch with skill search", async () => {
  const { service, calls } = createService({
    identityClient: {
      searchUsers: async (query, correlationId) => {
        calls.searchUsers.push([query, correlationId]);
        return [{ _id: "user-2", name: "Grace" }];
      },
      getUserSummaries: async () => [],
    },
  });

  await service.queryMentors(
    { skill: "React", name: "Grace" },
    { correlationId: "corr-2" },
  );

  assert.deepEqual(calls.searchUsers, [
    [{ name: "Grace", role: "mentor" }, "corr-2"],
  ]);
});

test("returns an empty page when name search has no matching mentors", async () => {
  const { service } = createService({
    identityClient: {
      searchUsers: async () => [],
      getUserSummaries: async () => [],
    },
  });

  const result = await service.queryMentors({ name: "Nobody" });

  assert.deepEqual(result.mentors, []);
  assert.equal(result.pagination.totalCount, 0);
});

test("rejects inverted numeric ranges", async () => {
  const { service } = createService();

  await assert.rejects(
    service.queryMentors({ minPrice: "100", maxPrice: "50" }),
    { statusCode: 400, code: "INVALID_SEARCH_RANGE" },
  );
});
