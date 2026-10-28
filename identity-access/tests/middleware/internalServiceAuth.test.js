const test = require("node:test");
const assert = require("node:assert/strict");

const createInternalServiceAuth = require("../../middleware/internalServiceAuth");

const run = (middleware, authorization) => {
  const result = { nextCalled: false, status: null, body: null };
  const req = {
    get: (name) => (name === "Authorization" ? authorization : undefined),
  };
  const res = {
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
  middleware(req, res, () => {
    result.nextCalled = true;
  });
  return result;
};

test("returns 503 when no token is configured", () => {
  for (const options of [
    {},
    { serviceToken: "" },
    { serviceTokens: ["", undefined] },
  ]) {
    const result = run(createInternalServiceAuth(options), "Bearer anything");
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "INTERNAL_AUTH_NOT_CONFIGURED");
    assert.equal(result.nextCalled, false);
  }
});

test("single serviceToken keeps its original behaviour", () => {
  const middleware = createInternalServiceAuth({
    serviceToken: "profile-token",
  });

  assert.equal(run(middleware, "Bearer profile-token").nextCalled, true);

  const rejected = run(middleware, "Bearer other-token");
  assert.equal(rejected.status, 401);
  assert.equal(rejected.body.code, "INVALID_INTERNAL_AUTH");
});

test("accepts each token in serviceTokens and rejects everything else", () => {
  const middleware = createInternalServiceAuth({
    serviceTokens: ["profile-token", "workspace-token"],
  });

  assert.equal(run(middleware, "Bearer profile-token").nextCalled, true);
  assert.equal(run(middleware, "Bearer workspace-token").nextCalled, true);

  for (const header of [
    undefined,
    "",
    "Bearer ",
    "Bearer unknown-token",
    "profile-token",
    "Basic profile-token",
    "Bearer profile-token-extra",
  ]) {
    const result = run(middleware, header);
    assert.equal(result.status, 401, `header ${JSON.stringify(header)}`);
    assert.equal(result.nextCalled, false);
  }
});

test("a missing token for one caller does not lock out the configured caller", () => {
  const middleware = createInternalServiceAuth({
    serviceTokens: ["profile-token", ""],
  });

  assert.equal(run(middleware, "Bearer profile-token").nextCalled, true);
  assert.equal(run(middleware, "Bearer ").status, 401);
});

test("serviceToken and serviceTokens can be combined", () => {
  const middleware = createInternalServiceAuth({
    serviceToken: "a",
    serviceTokens: ["b"],
  });

  assert.equal(run(middleware, "Bearer a").nextCalled, true);
  assert.equal(run(middleware, "Bearer b").nextCalled, true);
  assert.equal(run(middleware, "Bearer c").status, 401);
});
