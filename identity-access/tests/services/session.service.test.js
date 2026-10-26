const test = require("node:test");
const assert = require("node:assert/strict");

const createSessionService = require("../../services/session.service");

const createService = ({ tokenError = null, user = null } = {}) => {
  const tokenService = {
    verifyRefreshToken: () => {
      if (tokenError) throw tokenError;
      return { id: "user-1" };
    },
    signAccessToken: (id) => `access:${id}`,
  };
  const userRepository = {
    findUserById: async () => user,
  };
  return createSessionService({ userRepository, tokenService });
};

test("refreshes an access token for a valid refresh cookie", async () => {
  const service = createService({
    user: { _id: "user-1", name: "Jane", email: "jane@example.com", roles: ["mentee"] },
  });

  const result = await service.refreshAccessToken("refresh-token");
  assert.equal(result.accessToken, "access:user-1");
  assert.equal(result.user._id, "user-1");
  assert.equal(result.user.password, undefined);
});

test("rejects a missing refresh cookie", async () => {
  const service = createService();
  await assert.rejects(
    () => service.refreshAccessToken(),
    { statusCode: 401, code: "REFRESH_TOKEN_MISSING" },
  );
});

test("rejects an invalid or expired refresh token", async () => {
  const service = createService({
    tokenError: Object.assign(new Error("expired"), {
      statusCode: 403,
      code: "INVALID_REFRESH_TOKEN",
    }),
  });
  await assert.rejects(
    () => service.refreshAccessToken("expired-token"),
    { statusCode: 403, code: "INVALID_REFRESH_TOKEN" },
  );
});

test("rejects a refresh token for a missing user", async () => {
  const service = createService({ user: null });
  await assert.rejects(
    () => service.refreshAccessToken("refresh-token"),
    { statusCode: 401, code: "USER_NOT_FOUND" },
  );
});
