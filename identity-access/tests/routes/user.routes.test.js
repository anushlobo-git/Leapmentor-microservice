const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createUserController = require("../../controllers/user.controller");
const createUserRouter = require("../../routes/user.routes");
const { addRoleValidation } = require("../../middleware/userValidation");

const startTestServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

test("add-role route uses the authenticated user and returns the updated DTO", async () => {
  const controller = createUserController({
    authService: {
      addAccountRole: async (user, role) => ({
        _id: user._id,
        roles: [...user.roles, role],
      }),
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    userRouter: createUserRouter({
      userController: controller,
      authenticate: (req, _res, next) => {
        req.user = { _id: "user-1", roles: ["mentee"] };
        next();
      },
      validations: { addRoleValidation },
    }),
  });

  try {
    const response = await fetch(`${serverDetails.url}/api/v1/users/me/roles`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "mentor", userId: "other-user" }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data, { _id: "user-1", roles: ["mentee", "mentor"] });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("GET /users/me returns the authenticated account profile without the password", async () => {
  const controller = createUserController({
    authService: {},
    userService: {
      getCurrentUser: (user) => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      }),
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    userRouter: createUserRouter({
      userController: controller,
      authenticate: (req, _res, next) => {
        req.user = {
          _id: "user-1",
          name: "Jane Doe",
          email: "jane@example.com",
          password: "never-return-this",
          roles: ["mentee"],
        };
        next();
      },
      validations: { addRoleValidation },
    }),
  });

  try {
    const response = await fetch(`${serverDetails.url}/api/v1/users/me`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.data, {
      _id: "user-1",
      name: "Jane Doe",
      email: "jane@example.com",
      roles: ["mentee"],
    });
    assert.equal(body.data.password, undefined);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
