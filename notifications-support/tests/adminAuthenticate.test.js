const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createAdminAuthenticate = require("../middleware/adminAuthenticate");

test("rejects a revoked Admin token returned by Admin & Moderation", async () => {
  const secret = "admin-secret";
  const middleware = createAdminAuthenticate({
    accessSecret: secret,
    validateAdminToken: async () => {
      const error = new Error("Admin session has been revoked");
      error.statusCode = 401;
      error.code = "SESSION_REVOKED";
      throw error;
    },
  });
  const req = {
    get: () =>
      `adminToken=${jwt.sign({ id: "admin-1", role: "admin", type: "access", tokenVersion: 1 }, secret)}`,
  };
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "SESSION_REVOKED");
  assert.equal(nextCalled, false);
});
