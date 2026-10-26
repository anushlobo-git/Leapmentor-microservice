const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createInternalUserController = require("../../controllers/internalUser.controller");
const createInternalUserRouter = require("../../routes/internalUser.routes");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("internal user summary requires the Profile service token and returns a DTO", async () => {
  const controller = createInternalUserController({
    userRepository: {
      findUserById: async (id) => ({
        _id: id,
        name: "Jane Doe",
        email: "jane@example.com",
        password: "must-not-leak",
        roles: ["mentor"],
      }),
    },
    userService: {
      getCurrentUser: (user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      }),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    internalServiceAuth: createInternalServiceAuth({ serviceToken: "profile-token" }),
    internalUserRouter: createInternalUserRouter({ internalUserController: controller }),
  });

  try {
    const unauthorized = await fetch(`${serverDetails.url}/internal/v1/users/user-1`);
    const authorized = await fetch(`${serverDetails.url}/internal/v1/users/user-1`, {
      headers: { Authorization: "Bearer profile-token" },
    });

    assert.equal(unauthorized.status, 401);
    assert.equal(authorized.status, 200);
    assert.deepEqual((await authorized.json()).data, {
      _id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      roles: ["mentor"],
    });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("internal user search returns identity-owned summaries for a name query", async () => {
  const controller = createInternalUserController({
    userRepository: {
      findUserById: async () => null,
      findUsersByRoleAndNameRegex: async (name, roles) => [
        { _id: "user-2", name, roles },
      ],
    },
    userService: {
      getCurrentUser: (user) => ({
        _id: user._id,
        name: user.name,
        roles: user.roles,
      }),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    internalServiceAuth: createInternalServiceAuth({ serviceToken: "profile-token" }),
    internalUserRouter: createInternalUserRouter({ internalUserController: controller }),
  });

  try {
    const response = await fetch(
      `${serverDetails.url}/internal/v1/users?name=Grace&role=mentor`,
      { headers: { Authorization: "Bearer profile-token" } },
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data.users, [
      { _id: "user-2", name: "Grace", roles: ["mentor"] },
    ]);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
