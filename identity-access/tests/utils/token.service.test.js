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

test("signs and verifies access tokens while rejecting malformed or wrong-secret tokens", () => {
  const tokenService = createTokenService({
    accessSecret: "access-secret",
    refreshSecret: "refresh-secret",
    accessExpiresIn: "15m",
    refreshExpiresIn: "7d",
  });

  const accessToken = tokenService.signAccessToken({ toString: () => "user-2" });
  const decoded = tokenService.verifyAccessToken(accessToken);
  assert.equal(decoded.id, "user-2");
  assert.equal(decoded.type, "access");

  assert.throws(
    () => tokenService.verifyAccessToken("malformed"),
    { statusCode: 401, code: "INVALID_ACCESS_TOKEN" },
  );
  assert.throws(
    () => tokenService.verifyAccessToken(tokenService.signRefreshToken("user-2")),
    { statusCode: 401, code: "INVALID_ACCESS_TOKEN" },
  );
  assert.throws(
    () => tokenService.verifyRefreshToken("malformed"),
    { statusCode: 403, code: "INVALID_REFRESH_TOKEN" },
  );
});
