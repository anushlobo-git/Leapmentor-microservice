const test = require("node:test");
const assert = require("node:assert/strict");

const createAdminAuthenticate = require("../../middleware/adminAuthenticate");
const { validateLogin } = require("../../middleware/authValidation");
const validateEngagementQuery = require("../../middleware/engagementValidation");
const errorHandler = require("../../middleware/errorHandler");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createRequireReady = require("../../middleware/requireReady");
const settingsValidation = require("../../middleware/settingsValidation");
const { validateUsersQuery, validateUserId } = require("../../middleware/userValidation");

const runValidation = (middleware, req) => {
  let nextCalled = false;
  let error;
  middleware(req, {}, (value) => {
    nextCalled = true;
    error = value;
  });
  return { nextCalled, error };
};

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

test("login validation normalizes email and rejects malformed credentials", () => {
  const validReq = { body: { email: "  ADA@Example.com ", password: "password1" } };
  assert.equal(runValidation(validateLogin, validReq).nextCalled, true);
  assert.deepEqual(validReq.body, { email: "ada@example.com", password: "password1" });

  for (const body of [
    { email: "", password: "password1" },
    { email: "no-at-symbol", password: "password1" },
    { email: "a@example.com", password: "short" },
  ]) {
    const result = runValidation(validateLogin, { body });
    assert.equal(result.error.code, "INVALID_ADMIN_LOGIN");
    assert.equal(result.error.statusCode, 400);
  }
});

test("settings validation normalizes inputs and rejects invalid admin, password, and commission values", () => {
  const adminReq = { body: { name: " Ada ", email: " ADA@EXAMPLE.COM " } };
  assert.equal(runValidation(settingsValidation.validateAddAdmin, adminReq).nextCalled, true);
  assert.deepEqual(adminReq.body, { name: "Ada", email: "ada@example.com" });

  const passwordReq = { body: { oldPassword: "oldpassword", newPassword: "newpassword" } };
  assert.equal(runValidation(settingsValidation.validateChangePassword, passwordReq).nextCalled, true);
  assert.deepEqual(passwordReq.body, { oldPassword: "oldpassword", newPassword: "newpassword" });

  for (const body of [{ name: " ", email: "invalid" }, {}]) {
    assert.equal(runValidation(settingsValidation.validateAddAdmin, { body }).error.code, "INVALID_ADMIN_INPUT");
  }
  assert.equal(runValidation(settingsValidation.validateChangePassword, { body: { oldPassword: "short", newPassword: "longpassword" } }).error.code, "INVALID_PASSWORD_INPUT");
  assert.equal(runValidation(settingsValidation.validateChangePassword, { body: { oldPassword: "samepassword", newPassword: "samepassword" } }).error.code, "PASSWORD_UNCHANGED");

  for (const commissionRate of [-1, 101, "nope"]) {
    assert.equal(runValidation(settingsValidation.validateCommission, { body: { commissionRate } }).error.code, "INVALID_COMMISSION_RATE");
  }
  const commissionReq = { body: { commissionRate: "12.5" } };
  assert.equal(runValidation(settingsValidation.validateCommission, commissionReq).nextCalled, true);
  assert.deepEqual(commissionReq.body, { commissionRate: 12.5 });
});

test("user query and ID validation enforce paging, roles, deleted values, and ObjectIds", () => {
  const req = { query: { page: "2", limit: "25", role: "mentor", deleted: "false" } };
  assert.equal(runValidation(validateUsersQuery, req).nextCalled, true);
  assert.deepEqual(req.query, { page: "2", limit: "25", role: "mentor", deleted: "false" });

  for (const query of [
    { page: "0" },
    { limit: "101" },
    { role: "admin" },
    { deleted: "yes" },
  ]) {
    assert.equal(runValidation(validateUsersQuery, { query }).error.code, "INVALID_USER_QUERY");
  }

  assert.equal(runValidation(validateUserId, { params: { userId: "507f1f77bcf86cd799439011" } }).nextCalled, true);
  assert.equal(runValidation(validateUserId, { params: { userId: "not-an-id" } }).error.code, "INVALID_USER_ID");
});

test("engagement query validation accepts valid filters and rejects invalid statuses, dates, IDs, and pagination", () => {
  const valid = runValidation(validateEngagementQuery, {
    query: {
      status: "completed",
      search: "Ada",
      dateFrom: "2026-10-29",
      dateTo: "2026-10-30T12:00:00Z",
      page: "2",
      limit: "50",
      menteeId: "507f1f77bcf86cd799439011",
    },
  });
  assert.equal(valid.nextCalled, true);

  for (const query of [
    { status: "unknown" },
    { dateFrom: "2026-02-31" },
    { dateTo: "not-a-date" },
    { menteeId: "invalid" },
    { page: "0" },
    { limit: "101" },
  ]) {
    assert.equal(
      runValidation(validateEngagementQuery, { query }).error.code,
      "INVALID_ENGAGEMENT_QUERY",
    );
  }
});

test("ready middleware responds unavailable until persistence is ready", () => {
  const unavailable = response();
  let nextCalled = false;
  createRequireReady({ health: { isReady: () => false } })({}, unavailable, () => { nextCalled = true; });
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.code, "SERVICE_NOT_READY");
  assert.equal(nextCalled, false);

  createRequireReady({ health: { isReady: () => true } })({}, response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test("internal service authentication rejects missing or incorrect tokens", () => {
  const middleware = createInternalServiceAuth({ serviceToken: "secret" });
  const unauthorized = response();
  middleware({ get: () => "Bearer wrong" }, unauthorized, assert.fail);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(unauthorized.body.code, "INVALID_INTERNAL_AUTH");

  const unconfigured = response();
  createInternalServiceAuth({ serviceToken: "" })(
    { get: () => "Bearer secret" },
    unconfigured,
    assert.fail,
  );
  assert.equal(unconfigured.statusCode, 503);
  assert.equal(unconfigured.body.code, "INTERNAL_AUTH_NOT_CONFIGURED");
});

test("admin authentication validates token, administrator state, and token version", async () => {
  const admin = { _id: "admin-1", isActive: true, tokenVersion: 3 };
  const buildMiddleware = ({ token = "token", decoded = { id: "admin-1", role: "admin", type: "access", tokenVersion: 3 }, findAdmin = async () => admin } = {}) =>
    createAdminAuthenticate({
      adminUserRepository: { findAdminByIdFull: findAdmin },
      jwt: { verify: (candidate) => {
        if (candidate !== token) throw new Error("bad token");
        return decoded;
      } },
      accessSecret: "secret",
      toAdminDTO: (value) => ({ _id: value._id }),
    });

  const req = { cookies: { adminToken: "token" } };
  let nextCalled = false;
  await buildMiddleware()(req, {}, (error) => { if (error) throw error; nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.admin, { _id: "admin-1" });

  for (const { cookies, decoded, findAdmin, code } of [
    { cookies: {}, code: "INVALID_ADMIN_TOKEN" },
    { cookies: { adminToken: "bad-token" }, code: "INVALID_ADMIN_TOKEN" },
    { cookies: { adminToken: "token" }, decoded: { id: "admin-1", role: "user", type: "access" }, code: "INVALID_ADMIN_TOKEN" },
    { cookies: { adminToken: "token" }, findAdmin: async () => null, code: "ADMIN_NOT_FOUND" },
    { cookies: { adminToken: "token" }, findAdmin: async () => ({ ...admin, isActive: false }), code: "ADMIN_INACTIVE" },
    { cookies: { adminToken: "token" }, decoded: { id: "admin-1", role: "admin", type: "access", tokenVersion: 2 }, code: "SESSION_REVOKED" },
  ]) {
    let forwarded;
    await buildMiddleware({ cookies, decoded, findAdmin })(
      { cookies },
      {},
      (error) => { forwarded = error; },
    );
    assert.equal(forwarded.code, code);
  }

  let defaultVersionNextCalled = false;
  const defaultVersionAdmin = { ...admin, tokenVersion: undefined };
  await buildMiddleware({
    decoded: { id: "admin-1", role: "admin", type: "access", tokenVersion: 0 },
    findAdmin: async () => defaultVersionAdmin,
  })(
    { cookies: { adminToken: "token" } },
    {},
    (error) => { if (error) throw error; defaultVersionNextCalled = true; },
  );
  assert.equal(defaultVersionNextCalled, true);

  let repositoryError;
  await buildMiddleware({
    findAdmin: async () => { throw new Error("database unavailable"); },
  })(
    { cookies: { adminToken: "token" } },
    {},
    (error) => { repositoryError = error; },
  );
  assert.match(repositoryError.message, /database unavailable/);
});

test("error handler maps duplicate keys and application errors into response envelopes", () => {
  for (const [error, statusCode, code] of [
    [{ message: "duplicate", code: 11000 }, 409, 11000],
    [{ message: "invalid", statusCode: 422, code: "INVALID" }, 422, "INVALID"],
    [{}, 500, "INTERNAL_ERROR"],
  ]) {
    const res = response();
    errorHandler(error, {}, res, () => {});
    assert.equal(res.statusCode, statusCode);
    assert.equal(res.body.code, code);
  }
});
