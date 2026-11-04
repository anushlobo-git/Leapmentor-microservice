const test = require("node:test");
const assert = require("node:assert/strict");

const errorHandler = require("../../middleware/errorHandler");

test("returns the application error contract with standard defaults", () => {
  const response = () => ({
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });
  const res = response();
  errorHandler({ statusCode: 409, message: "Conflict", code: "DUPLICATE" }, {}, res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    success: false,
    data: null,
    message: "Conflict",
    error: "Conflict",
    code: "DUPLICATE",
  });

  const fallback = response();
  errorHandler({ statusCode: "invalid", message: "" }, {}, fallback);
  assert.equal(fallback.statusCode, 500);
  assert.equal(fallback.body.message, "Internal server error");
  assert.equal(fallback.body.error, "Internal server error");
  assert.equal(fallback.body.code, "INTERNAL_ERROR");
});
