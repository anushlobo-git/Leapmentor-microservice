const test = require("node:test");
const assert = require("node:assert/strict");

const createAuthController = require("../../controllers/auth.controller");
const createDashboardController = require("../../controllers/dashboard.controller");
const createInternalAdminAuthController = require("../../controllers/internalAdminAuth.controller");
const createLeapRequestsController = require("../../controllers/leapRequests.controller");
const createPaymentsController = require("../../controllers/payments.controller");
const createReportsController = require("../../controllers/reports.controller");
const createSettingsController = require("../../controllers/settings.controller");
const createUserManagementController = require("../../controllers/userManagement.controller");
const createVerificationController = require("../../controllers/verification.controller");

const response = () => ({
  statusCode: null,
  body: null,
  cookies: [],
  clearedCookies: [],
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  cookie(...args) {
    this.cookies.push(args);
    return this;
  },
  clearCookie(...args) {
    this.clearedCookies.push(args);
    return this;
  },
});

const captureError = (callback) => {
  let forwarded;
  return {
    next: (error) => {
      forwarded = error;
    },
    get error() {
      return forwarded;
    },
    callback,
  };
};

test("auth controller sets both cookies, refreshes, logs out, and returns admin profile", async () => {
  const calls = [];
  const controller = createAuthController({
    authService: {
      adminLogin: async (body) => {
        calls.push(["login", body]);
        return { accessToken: "access", refreshToken: "refresh", admin: { name: "Ada" } };
      },
      refreshAdminToken: async (token) => {
        calls.push(["refresh", token]);
        return { accessToken: "new-access", refreshToken: "new-refresh" };
      },
      logout: async (token) => calls.push(["logout", token]),
    },
  });
  const req = { body: { email: "ada@example.com" }, cookies: { adminRefreshToken: "refresh" }, admin: { _id: "admin-1" } };

  const loginResponse = response();
  await controller.login(req, loginResponse, assert.fail);
  assert.equal(loginResponse.statusCode, 200);
  assert.equal(loginResponse.cookies.length, 2);
  assert.deepEqual(loginResponse.body.data.admin, { name: "Ada" });

  const refreshResponse = response();
  await controller.refresh(req, refreshResponse, assert.fail);
  assert.equal(refreshResponse.cookies[0][1], "new-access");
  assert.equal(refreshResponse.cookies[1][1], "new-refresh");

  const logoutResponse = response();
  await controller.logout(req, logoutResponse, assert.fail);
  assert.equal(logoutResponse.clearedCookies.length, 2);
  assert.deepEqual(calls, [
    ["login", req.body],
    ["refresh", "refresh"],
    ["logout", "refresh"],
  ]);
  assert.equal(controller.me(req, response()).body.data.admin, req.admin);
});

test("auth controller forwards service failures to Express", async () => {
  const expected = new Error("login failed");
  const controller = createAuthController({
    authService: { adminLogin: async () => { throw expected; } },
  });
  let forwarded;
  await controller.login({ body: {} }, response(), (error) => { forwarded = error; });
  assert.equal(forwarded, expected);
});

test("dashboard controller delegates all actions and wraps each result", async () => {
  const calls = [];
  const dashboardService = Object.fromEntries(
    ["getStats", "getUserGrowth", "getMentorIndustryStats", "getEngagementStats", "getEngagements"]
      .map((method) => [method, async (...args) => { calls.push([method, ...args]); return method; }]),
  );
  const controller = createDashboardController({ dashboardService });
  const req = { query: { days: "30" }, correlationId: "corr-1" };
  for (const [method, message] of [
    ["getStats", "Platform stats retrieved"],
    ["getUserGrowth", "User growth data retrieved"],
    ["getMentorIndustryStats", "Mentor industry stats retrieved"],
    ["getEngagementStats", "Engagement stats retrieved"],
    ["getEngagements", "Engagements retrieved"],
  ]) {
    const res = response();
    await controller[method](req, res, assert.fail);
    assert.equal(res.body.message, message);
    assert.equal(res.body.data, method);
  }
  assert.deepEqual(calls[1], ["getUserGrowth", "30", "corr-1"]);
  assert.deepEqual(calls[4], ["getEngagements", req.query, "corr-1"]);
});

test("leap request controller delegates list, count, approval, and rejection", async () => {
  const calls = [];
  const controller = createLeapRequestsController({
    leapRequestsService: Object.fromEntries(
      ["getRequests", "getPendingCount", "approve", "reject"].map((method) => [
        method,
        async (...args) => { calls.push([method, ...args]); return method; },
      ]),
    ),
  });
  const req = {
    query: { status: "pending" },
    params: { id: "request-1" },
    admin: { _id: "admin-1" },
    correlationId: "corr-1",
  };
  for (const method of ["getRequests", "getPendingCount", "approve", "reject"]) {
    const res = response();
    await controller[method](req, res, assert.fail);
    assert.equal(res.statusCode, 200);
  }
  assert.deepEqual(calls, [
    ["getRequests", "pending", "corr-1"],
    ["getPendingCount", "corr-1"],
    ["approve", "request-1", "admin-1", "corr-1"],
    ["reject", "request-1", "admin-1", "corr-1"],
  ]);
});

test("payments controller wraps stats, chart, and transaction results", async () => {
  const calls = [];
  const controller = createPaymentsController({
    paymentsService: Object.fromEntries(
      ["getStats", "getRevenueChart", "getTransactions"].map((method) => [
        method,
        async (...args) => { calls.push([method, ...args]); return method; },
      ]),
    ),
  });
  const req = { query: { page: "2" }, correlationId: "corr-1" };
  for (const method of ["getStats", "getRevenueChart", "getTransactions"]) {
    const res = response();
    await controller[method](req, res, assert.fail);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data, method);
  }
  assert.deepEqual(calls[2], ["getTransactions", req.query, "corr-1"]);
});

test("reports controller delegates all operations with admin and correlation context", async () => {
  const calls = [];
  const reportsService = Object.fromEntries(
    ["getStats", "getReports", "updateReport", "processRefund", "deleteSession"]
      .map((method) => [method, async (...args) => { calls.push([method, ...args]); return method; }]),
  );
  const controller = createReportsController({ reportsService });
  const req = {
    query: { page: "1" },
    params: { reportId: "report-1" },
    body: { status: "resolved", adminNote: "reviewed" },
    admin: { _id: "admin-1" },
    correlationId: "corr-1",
  };
  for (const method of ["getStats", "getReports", "updateReport", "processRefund", "deleteSession"]) {
    const res = response();
    await controller[method](req, res, assert.fail);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  }
  assert.deepEqual(calls[1], ["getReports", req.query, "corr-1"]);
  assert.deepEqual(calls[2], ["updateReport", "report-1", req.body, "admin-1", "corr-1"]);
  assert.deepEqual(calls[3], ["processRefund", "report-1", "reviewed", "admin-1", "corr-1"]);
  assert.deepEqual(calls[4], ["deleteSession", "report-1", "reviewed", "admin-1", "corr-1"]);
});

test("settings controller delegates operations and returns expected status codes", async () => {
  const calls = [];
  const settingsService = Object.fromEntries(
    ["getOverview", "addAdmin", "changePassword", "getCommission", "updateCommission"]
      .map((method) => [method, async (...args) => { calls.push([method, ...args]); return method; }]),
  );
  const controller = createSettingsController({ settingsService });
  const req = {
    body: { name: "Ada", commissionRate: 10, oldPassword: "oldpassword" },
    admin: { _id: "admin-1" },
    correlationId: "corr-1",
  };
  for (const [method, expectedStatus] of [
    ["getOverview", 200],
    ["addAdmin", 201],
    ["changePassword", 200],
    ["getCommission", 200],
    ["updateCommission", 200],
  ]) {
    const res = response();
    await controller[method](req, res, assert.fail);
    assert.equal(res.statusCode, expectedStatus);
  }
  assert.deepEqual(calls[1], ["addAdmin", req.body]);
  assert.deepEqual(calls[2], ["changePassword", "admin-1", req.body]);
  assert.deepEqual(calls[4], ["updateCommission", "admin-1", 10, "corr-1"]);
});

test("user management controller delegates list, detail, block and unblock", async () => {
  const calls = [];
  const userManagementService = Object.fromEntries(
    ["getUsers", "getUserDetail", "blockUser", "unblockUser"].map((method) => [
      method,
      async (...args) => {
        calls.push([method, ...args]);
        return method.endsWith("User") ? { name: "Ada", user: { _id: "user-1" } } : method;
      },
    ]),
  );
  const controller = createUserManagementController({ userManagementService });
  const req = {
    query: { role: "mentor" },
    params: { userId: "user-1" },
    correlationId: "corr-1",
  };
  for (const method of ["getUsers", "getUserDetail", "blockUser", "unblockUser"]) {
    const res = response();
    await controller[method](req, res, assert.fail);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  }
  assert.deepEqual(calls[0], ["getUsers", req.query, "corr-1"]);
  assert.deepEqual(calls[1], ["getUserDetail", "user-1", "corr-1"]);
  assert.deepEqual(calls[2], ["blockUser", "user-1", "corr-1"]);
  assert.deepEqual(calls[3], ["unblockUser", "user-1", "corr-1"]);
});

test("verification controller delegates list, detail, verify, and revoke", async () => {
  const calls = [];
  const verificationService = Object.fromEntries(
    ["list", "getById", "verify", "revoke"].map((method) => [
      method,
      async (...args) => { calls.push([method, ...args]); return method; },
    ]),
  );
  const controller = createVerificationController({ verificationService });
  const req = { params: { mentorProfileId: "profile-1" }, correlationId: "corr-1" };
  for (const method of ["list", "getById", "verify", "revoke"]) {
    const res = response();
    await controller[method](req, res, assert.fail);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  }
  assert.deepEqual(calls, [
    ["list", "corr-1"],
    ["getById", "profile-1", "corr-1"],
    ["verify", "profile-1", "corr-1"],
    ["revoke", "profile-1", "corr-1"],
  ]);
});

test("internal admin auth controller rejects missing tokens and returns valid sessions", async () => {
  const controller = createInternalAdminAuthController({
    adminUserRepository: {
      findAdminByIdFull: async () => ({
        _id: "admin-1",
        isActive: true,
        tokenVersion: 2,
      }),
    },
    jwt: {
      verify: () => ({ id: "admin-1", role: "admin", type: "access", tokenVersion: 2 }),
    },
    accessSecret: "secret",
    toAdminDTO: (admin) => ({ _id: admin._id }),
  });
  const missingError = captureError();
  await controller.validateSession({ body: {} }, response(), missingError.next);
  assert.equal(missingError.error.code, "ADMIN_TOKEN_REQUIRED");

  const res = response();
  await controller.validateSession({ body: { token: "token" } }, res, assert.fail);
  assert.deepEqual(res.body.data.admin, { _id: "admin-1" });
});

test("controllers forward service failures to the shared Express error handler", async () => {
  const expected = new Error("dependency failed");
  const failingService = new Proxy({}, {
    get: () => async () => { throw expected; },
  });
  const cases = [
    [createAuthController({ authService: failingService }), ["login", "refresh", "logout"]],
    [createDashboardController({ dashboardService: failingService }), [
      "getStats", "getUserGrowth", "getMentorIndustryStats", "getEngagementStats", "getEngagements",
    ]],
    [createLeapRequestsController({ leapRequestsService: failingService }), [
      "getRequests", "getPendingCount", "approve", "reject",
    ]],
    [createPaymentsController({ paymentsService: failingService }), [
      "getStats", "getRevenueChart", "getTransactions",
    ]],
    [createReportsController({ reportsService: failingService }), [
      "getStats", "getReports", "updateReport", "processRefund", "deleteSession",
    ]],
    [createSettingsController({ settingsService: failingService }), [
      "getOverview", "addAdmin", "changePassword", "getCommission", "updateCommission",
    ]],
    [createUserManagementController({ userManagementService: failingService }), [
      "getUsers", "getUserDetail", "blockUser", "unblockUser",
    ]],
    [createVerificationController({ verificationService: failingService }), [
      "list", "getById", "verify", "revoke",
    ]],
  ];
  const req = {
    body: { commissionRate: 10 },
    cookies: { adminRefreshToken: "token" },
    query: {},
    params: { reportId: "report-1", userId: "user-1", mentorProfileId: "profile-1", id: "request-1" },
    admin: { _id: "admin-1" },
    correlationId: "corr",
  };

  for (const [controller, methods] of cases) {
    for (const method of methods) {
      let forwarded;
      await controller[method](req, response(), (error) => { forwarded = error; });
      assert.equal(forwarded, expected, `${method} should forward errors`);
    }
  }
});

test("internal admin auth controller forwards repository failures", async () => {
  const expected = new Error("database failure");
  const controller = createInternalAdminAuthController({
    adminUserRepository: {
      findAdminByIdFull: async () => { throw expected; },
    },
    jwt: {
      verify: () => ({ id: "admin-1", role: "admin", type: "access", tokenVersion: 0 }),
    },
    accessSecret: "secret",
    toAdminDTO: (admin) => admin,
  });
  let forwarded;
  await controller.validateSession(
    { body: { token: "token" } },
    response(),
    (error) => { forwarded = error; },
  );
  assert.equal(forwarded, expected);
});
