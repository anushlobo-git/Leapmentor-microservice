const test = require("node:test");
const assert = require("node:assert/strict");

const createUserManagementService = require("../../services/userManagement.service");

test("user list combines Identity users with Profile-owned profiles and pagination", async () => {
  const service = createUserManagementService({
    identityClient: {
      listUsers: async () => ({
        data: {
          users: [{ _id: "user-1", name: "Ada", roles: ["mentor"] }],
          pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
        },
      }),
    },
    profileClient: {
      getProfiles: async () => ({ data: { profiles: [{ userId: "user-1", profile: { industry: "Tech" } }] } }),
    },
    workspaceClient: { getCompletedSessionCount: async () => ({ data: { sessionCount: 3 } }) },
  });

  const result = await service.getUsers({ page: "1", limit: "20" }, "corr-1");

  assert.deepEqual(result, {
    users: [{ _id: "user-1", name: "Ada", roles: ["mentor"], profile: { industry: "Tech" } }],
    pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
  });
});

test("user detail combines Identity, Profile, and Workspace-owned data", async () => {
  const service = createUserManagementService({
    identityClient: { getUser: async () => ({ data: { user: { _id: "user-1" } } }) },
    profileClient: { getProfiles: async () => ({ data: { profiles: [{ userId: "user-1", profile: { bio: "Hello" } }] } }) },
    workspaceClient: { getCompletedSessionCount: async () => ({ data: { sessionCount: 7 } }) },
  });

  assert.deepEqual(await service.getUserDetail("user-1", "corr-2"), {
    user: { _id: "user-1" },
    profile: { bio: "Hello" },
    sessionCount: 7,
  });
});

test("block and unblock delegate state changes to Identity", async () => {
  const calls = [];
  const service = createUserManagementService({
    identityClient: {
      blockUser: async (id) => { calls.push(["block", id]); return { data: { user: { name: "Ada" } } }; },
      unblockUser: async (id) => { calls.push(["unblock", id]); return { data: { user: { name: "Ada" } } }; },
    },
    profileClient: { getProfiles: async () => ({ data: { profiles: [] } }) },
    workspaceClient: { getCompletedSessionCount: async () => ({ data: { sessionCount: 0 } }) },
  });

  assert.equal((await service.blockUser("user-1", "corr-3")).name, "Ada");
  assert.equal((await service.unblockUser("user-1", "corr-4")).name, "Ada");
  assert.deepEqual(calls, [["block", "user-1"], ["unblock", "user-1"]]);
});

test("user list supplies pagination and null-profile fallbacks for empty or partial responses", async () => {
  const service = createUserManagementService({
    identityClient: {
      listUsers: async (query) => query.role === "empty"
        ? {}
        : { data: { users: [{ _id: "user-2" }] } },
    },
    profileClient: {
      getProfiles: async () => ({}),
    },
    workspaceClient: {},
  });

  assert.deepEqual(await service.getUsers({ page: "2", limit: "10", role: "empty" }), {
    users: [],
    pagination: { total: 0, page: 2, limit: 10, totalPages: 0 },
  });
  assert.deepEqual(await service.getUsers({}), {
    users: [{ _id: "user-2", profile: null }],
    pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
  });
});

test("user detail defaults missing profile and completed-session data and rejects missing Identity users", async () => {
  const service = createUserManagementService({
    identityClient: { getUser: async () => ({ data: { user: { _id: "user-1" } } }) },
    profileClient: { getProfiles: async () => ({ data: { profiles: [] } }) },
    workspaceClient: { getCompletedSessionCount: async () => ({ data: {} }) },
  });

  assert.deepEqual(await service.getUserDetail("user-1"), {
    user: { _id: "user-1" },
    profile: null,
    sessionCount: 0,
  });

  const missingUserService = createUserManagementService({
    identityClient: { getUser: async () => ({ data: {} }) },
    profileClient: { getProfiles: async () => ({}) },
    workspaceClient: { getCompletedSessionCount: async () => ({}) },
  });
  await assert.rejects(
    missingUserService.getUserDetail("missing-user"),
    (error) => error.statusCode === 404 && error.code === "USER_NOT_FOUND",
  );
});

test("block and unblock report missing users from Identity", async () => {
  const service = createUserManagementService({
    identityClient: {
      blockUser: async () => ({}),
      unblockUser: async () => ({ data: {} }),
    },
    profileClient: {},
    workspaceClient: {},
  });

  await assert.rejects(
    service.blockUser("missing-user"),
    (error) => error.statusCode === 404 && error.code === "USER_NOT_FOUND",
  );
  await assert.rejects(
    service.unblockUser("missing-user"),
    (error) => error.statusCode === 404 && error.code === "USER_NOT_FOUND",
  );
});
