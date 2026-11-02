const test = require("node:test");
const assert = require("node:assert/strict");

const createIdentityAdminClient = require("../../clients/identityAdminClient");
const createWorkspaceAdminClient = require("../../clients/workspaceAdminClient");

test("looks up distinct user summaries through Identity's internal endpoint", async () => {
  let request;
  const client = createIdentityAdminClient({
    httpClient: {
      request: async (options) => {
        request = options;
        return { data: { users: [{ _id: "mentee-1", name: "Jane" }] } };
      },
    },
  });

  const users = await client.getUserSummaries(
    ["mentee-1", "mentee-1", null],
    "correlation-1",
  );

  assert.deepEqual(request, {
    method: "GET",
    path: "/internal/v1/users?ids=mentee-1",
    correlationId: "correlation-1",
  });
  assert.deepEqual(users, [{ _id: "mentee-1", name: "Jane" }]);
  assert.deepEqual(await client.getUserSummaries([], "correlation-2"), []);
});

test("forwards the mentee ID history filter to Workspace", async () => {
  let request;
  const client = createWorkspaceAdminClient({
    httpClient: {
      request: async (options) => {
        request = options;
        return { data: { engagements: [] } };
      },
    },
  });

  await client.getEngagements(
    { menteeId: "mentee-1", page: 1, limit: 50 },
    "correlation-3",
  );

  assert.deepEqual(request, {
    method: "GET",
    path: "/internal/v1/admin/engagements?page=1&limit=50&menteeId=mentee-1",
    correlationId: "correlation-3",
  });
});

test("Identity Admin client forwards admin user, status, and growth operations", async () => {
  const calls = [];
  const client = createIdentityAdminClient({
    httpClient: {
      request: async (request) => {
        calls.push(request);
        return { success: true };
      },
    },
  });

  await client.listUsers(
    { search: "Ada Lovelace", role: "mentee", page: 2, limit: 10, deleted: false },
    "corr",
  );
  await client.getUser("user/1", "corr");
  await client.blockUser("user/1", "corr");
  await client.unblockUser("user/2", "corr");
  await client.getStats("corr");
  await client.getUserGrowth(30, "corr");
  await client.getUserGrowth(undefined, "corr");

  assert.deepEqual(calls, [
    {
      method: "GET",
      path: "/internal/v1/admin/users?search=Ada+Lovelace&role=mentee&page=2&limit=10&deleted=false",
      correlationId: "corr",
    },
    {
      method: "GET",
      path: "/internal/v1/admin/users/user%2F1",
      correlationId: "corr",
    },
    {
      method: "PATCH",
      path: "/internal/v1/admin/users/user%2F1/block",
      correlationId: "corr",
    },
    {
      method: "PATCH",
      path: "/internal/v1/admin/users/user%2F2/unblock",
      correlationId: "corr",
    },
    {
      method: "GET",
      path: "/internal/v1/admin/stats",
      correlationId: "corr",
    },
    {
      method: "GET",
      path: "/internal/v1/admin/user-growth?days=30",
      correlationId: "corr",
    },
    {
      method: "GET",
      path: "/internal/v1/admin/user-growth?days=90",
      correlationId: "corr",
    },
  ]);
});
