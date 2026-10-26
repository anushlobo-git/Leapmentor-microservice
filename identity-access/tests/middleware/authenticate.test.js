const test = require("node:test");
const assert = require("node:assert/strict");

const createAuthenticate = require("../../middleware/authenticate");

test("attaches the authenticated user from a valid bearer token", async () => {
  const middleware = createAuthenticate({
    tokenService: { verifyAccessToken: (token) => ({ id: token }) },
    userRepository: {
      findUserByIdForAuthentication: async () => ({
        _id: "user-1",
        roles: ["mentee"],
        isDeleted: false,
      }),
    },
  });
  const req = { get: () => "Bearer access-token" };
  const res = { status: () => res, json: () => res };
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user._id, "user-1");
});

test("rejects requests without a bearer token", async () => {
  const middleware = createAuthenticate({
    tokenService: { verifyAccessToken: () => assert.fail("not called") },
    userRepository: {},
  });
  let statusCode;
  let body;
  const req = { get: () => undefined };
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (value) => {
      body = value;
      return res;
    },
  };

  await middleware(req, res, () => assert.fail("next must not run"));
  assert.equal(statusCode, 401);
  assert.deepEqual(body, { message: "No token provided" });
});

test("blocks a deleted account with 403", async () => {
  const middleware = createAuthenticate({
    tokenService: { verifyAccessToken: () => ({ id: "user-1" }) },
    userRepository: {
      findUserByIdForAuthentication: async () => ({
        _id: "user-1",
        isDeleted: true,
      }),
    },
  });
  let statusCode;
  const req = { get: () => "Bearer token" };
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: () => res,
  };

  await middleware(req, res, () => assert.fail("next must not run"));
  assert.equal(statusCode, 403);
});
