const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../app");
const createUserManagementController = require("../controllers/userManagement.controller");
const createUserManagementRouter = require("../routes/userManagement.routes");
const { validateUsersQuery, validateUserId } = require("../middleware/userValidation");

const startServer = async (service) => {
  const server = http.createServer(createApp({
    health: { isReady: () => true },
    userManagementRouter: createUserManagementRouter({
      controller: createUserManagementController({ userManagementService: service }),
      authenticate: (_req, _res, next) => next(),
      validateUsersQuery,
      validateUserId,
    }),
  }));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("admin user routes list users and preserve the response envelope", async () => {
  const { server, url } = await startServer({
    getUsers: async (query, correlationId) => ({
      users: [{ _id: "user-1", profile: null }],
      pagination: { total: 1, page: Number(query.page), limit: Number(query.limit), totalPages: 1 },
      correlationId,
    }),
  });

  try {
    const response = await fetch(`${url}/api/v1/admin/users?role=mentor&limit=10`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.users[0]._id, "user-1");
    assert.equal(body.data.pagination.limit, 10);
    assert.ok(response.headers.get("x-correlation-id"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("admin user routes validate ids before calling the service", async () => {
  let called = false;
  const { server, url } = await startServer({
    getUserDetail: async () => { called = true; return {}; },
  });

  try {
    const response = await fetch(`${url}/api/v1/admin/users/not-an-object-id`);
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.code, "INVALID_USER_ID");
    assert.equal(called, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("block and unblock routes return the affected user", async () => {
  const service = {
    blockUser: async () => ({ name: "Ada", user: { _id: "user-1", isDeleted: true } }),
    unblockUser: async () => ({ name: "Ada", user: { _id: "user-1", isDeleted: false } }),
  };
  const { server, url } = await startServer(service);

  try {
    const block = await fetch(`${url}/api/v1/admin/users/507f1f77bcf86cd799439011/block`, { method: "PATCH" });
    const unblock = await fetch(`${url}/api/v1/admin/users/507f1f77bcf86cd799439011/unblock`, { method: "PATCH" });
    assert.equal(block.status, 200);
    assert.equal((await block.json()).data.user.isDeleted, true);
    assert.equal(unblock.status, 200);
    assert.equal((await unblock.json()).data.user.isDeleted, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
