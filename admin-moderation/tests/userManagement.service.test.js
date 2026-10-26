const test = require("node:test");
const assert = require("node:assert/strict");

const createUserManagementService = require("../services/userManagement.service");

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
