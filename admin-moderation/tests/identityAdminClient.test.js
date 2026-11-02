const test = require("node:test");
const assert = require("node:assert/strict");

const createIdentityAdminClient = require("../clients/identityAdminClient");
const createWorkspaceAdminClient = require("../clients/workspaceAdminClient");

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
