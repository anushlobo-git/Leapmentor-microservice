const test = require("node:test");
const assert = require("node:assert/strict");

const createUserController = require("../../controllers/user.controller");

test("getMe returns the authenticated user's DTO", async () => {
  const controller = createUserController({
    authService: {},
    userService: {
      getCurrentUser: (user) => ({ _id: user._id, roles: user.roles }),
    },
  });
  let response;
  const res = {
    status: (code) => {
      response = { statusCode: code };
      return res;
    },
    json: (body) => {
      response.body = body;
      return res;
    },
  };

  await controller.getMe(
    { user: { _id: "user-1", roles: ["mentee"] } },
    res,
    assert.fail,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: { _id: "user-1", roles: ["mentee"] },
    message: "Current user",
  });
});
