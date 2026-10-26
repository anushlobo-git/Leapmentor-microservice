const test = require("node:test");
const assert = require("node:assert/strict");

const createTokenService = require("../../utils/token.service");

test("signs and verifies refresh tokens while rejecting access tokens", () => {
  const tokenService = createTokenService({
    accessSecret: "access-secret",
    refreshSecret: "refresh-secret",
    accessExpiresIn: "15m",
    refreshExpiresIn: "7d",
  });

  const refreshToken = tokenService.signRefreshToken("user-1");
  const decoded = tokenService.verifyRefreshToken(refreshToken);
  assert.equal(decoded.id, "user-1");
  assert.equal(decoded.type, "refresh");

  const accessToken = tokenService.signAccessToken("user-1");
  assert.throws(
    () => tokenService.verifyRefreshToken(accessToken),
    { statusCode: 403, code: "INVALID_REFRESH_TOKEN" },
  );
});
