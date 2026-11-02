const test = require("node:test");
const assert = require("node:assert/strict");

const createForgotPasswordController = require("../../controllers/forgotPassword.controller");
const createVerificationController = require("../../controllers/verification.controller");
const createInternalUserController = require("../../controllers/internalUser.controller");
const createInternalAdminUserController = require("../../controllers/internalAdminUser.controller");
const createInternalAdminStatsController = require("../../controllers/internalAdminStats.controller");
const createRefreshController = require("../../controllers/refresh.controller");
const createUserController = require("../../controllers/user.controller");

const createResponse = () => ({
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

const invoke = async (handler, req) => {
  const res = createResponse();
  let error;
  await handler(req, res, (value) => {
    error = value;
  });
  return { res, error };
};

test("forgot-password controller delegates each operation and forwards service errors", async () => {
  const calls = [];
  const controller = createForgotPasswordController({
    forgotPasswordService: {
      sendForgotPasswordOtp: async (...args) => { calls.push(["send", ...args]); return { sent: true }; },
      verifyResetOtp: async (...args) => { calls.push(["verify", ...args]); return { verified: true }; },
      resetPassword: async (...args) => { calls.push(["reset", ...args]); return { reset: true }; },
    },
  });

  const req = { body: { email: "ada@example.com", otp: "123456", newPassword: "secret1" } };
  for (const [handler, message] of [
    [controller.sendForgotPasswordOtp, "Password reset OTP sent"],
    [controller.verifyResetOtp, "Reset OTP verified"],
    [controller.resetPassword, "Password reset successfully"],
  ]) {
    const { res, error } = await invoke(handler, req);
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, message);
    assert.equal(res.body.success, true);
  }
  assert.deepEqual(calls, [
    ["send", "ada@example.com"],
    ["verify", "ada@example.com", "123456"],
    ["reset", { email: "ada@example.com", otp: "123456", newPassword: "secret1" }],
  ]);

  const failureController = createForgotPasswordController({
    forgotPasswordService: {
      sendForgotPasswordOtp: async () => { throw new Error("mail failed"); },
      verifyResetOtp: async () => { throw new Error("verify failed"); },
      resetPassword: async () => { throw new Error("reset failed"); },
    },
  });
  assert.match((await invoke(failureController.sendForgotPasswordOtp, req)).error.message, /mail failed/);
  assert.match((await invoke(failureController.verifyResetOtp, req)).error.message, /verify failed/);
  assert.match((await invoke(failureController.resetPassword, req)).error.message, /reset failed/);
});

test("verification controller handles send, resend, OTP, link, and service errors", async () => {
  const calls = [];
  const controller = createVerificationController({
    verificationService: {
      initiateVerification: async (...args) => calls.push(["initiate", ...args]),
      processOtpVerification: async (...args) => calls.push(["otp", ...args]),
      processLinkVerification: async (...args) => {
        calls.push(["link", ...args]);
        return { role: "mentor" };
      },
    },
  });
  const req = {
    body: { email: "ada@example.com", otp: "123456" },
    params: { token: "magic-token" },
    query: { email: "ada@example.com" },
  };

  for (const handler of [
    controller.sendVerification,
    controller.resendVerification,
    controller.verifyOtp,
    controller.verifyLink,
  ]) {
    const { res, error } = await invoke(handler, req);
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  }
  assert.deepEqual(calls, [
    ["initiate", "ada@example.com"],
    ["initiate", "ada@example.com", " (Resend)"],
    ["otp", "ada@example.com", "123456"],
    ["link", "magic-token", "ada@example.com"],
  ]);
  assert.deepEqual((await invoke(controller.verifyLink, req)).res.body.data, { role: "mentor" });

  const failureController = createVerificationController({
    verificationService: {
      initiateVerification: async () => { throw new Error("verification failed"); },
      processOtpVerification: async () => { throw new Error("OTP failed"); },
      processLinkVerification: async () => { throw new Error("link failed"); },
    },
  });
  assert.match((await invoke(failureController.sendVerification, req)).error.message, /verification failed/);
  assert.match((await invoke(failureController.resendVerification, req)).error.message, /verification failed/);
  assert.match((await invoke(failureController.verifyOtp, req)).error.message, /OTP failed/);
  assert.match((await invoke(failureController.verifyLink, req)).error.message, /link failed/);
});

test("internal user controller validates search input, returns summaries, and forwards errors", async () => {
  const calls = [];
  const userRepository = {
    findUserById: async (id) => id === "missing" ? null : { _id: id, name: "Ada" },
    findUsersByIds: async (ids) => { calls.push(["ids", ids]); return [{ _id: ids[0] }]; },
    findUsersByRoleAndNameRegex: async (...args) => { calls.push(["search", ...args]); return [{ _id: "user-2" }]; },
  };
  const userService = { getCurrentUser: (user) => ({ _id: user._id }) };
  const controller = createInternalUserController({ userRepository, userService });

  assert.equal((await invoke(controller.getUserSummary, { params: { id: "missing" } })).res.statusCode, 404);
  assert.deepEqual(
    (await invoke(controller.getUserSummary, { params: { id: "user-1" } })).res.body.data,
    { _id: "user-1" },
  );
  assert.equal((await invoke(controller.searchUsers, { query: {} })).res.statusCode, 400);
  const byIds = await invoke(controller.searchUsers, { query: { ids: " user-1, ,user-2 " } });
  assert.equal(byIds.res.statusCode, 200);
  assert.deepEqual(calls[0], ["ids", ["user-1", "user-2"]]);
  const byName = await invoke(controller.searchUsers, { query: { name: " Ada ", role: "mentor" } });
  assert.equal(byName.res.statusCode, 200);
  assert.deepEqual(calls[1], ["search", "Ada", ["mentor"]]);

  const failingController = createInternalUserController({
    userRepository: {
      findUserById: async () => { throw new Error("lookup failed"); },
      findUsersByRoleAndNameRegex: async () => { throw new Error("search failed"); },
    },
    userService,
  });
  assert.match((await invoke(failingController.getUserSummary, { params: { id: "user-1" } })).error.message, /lookup failed/);
  assert.match((await invoke(failingController.searchUsers, { query: { name: "Ada" } })).error.message, /search failed/);
});

test("internal Admin user controller lists, details, blocks, and restores users", async () => {
  const calls = [];
  const userRepository = {
    findAdminUsers: async (query) => ({ users: [{ _id: "user-1" }], pagination: { total: 1 }, query }),
    findAdminUserById: async (id) =>
      id === "507f191e810c19729de860ea" ? null : { _id: id },
    updateAdminUserDeletedState: async (id, deleted) => {
      calls.push([id, deleted]);
      return id === "507f191e810c19729de860ea"
        ? null
        : { _id: id, isDeleted: deleted };
    },
  };
  const controller = createInternalAdminUserController({
    userRepository,
    userService: { getCurrentUser: (user) => ({ _id: user._id, isDeleted: user.isDeleted }) },
  });

  const listed = await invoke(controller.listUsers, { query: { page: "2", role: "mentor" } });
  assert.equal(listed.res.statusCode, 200);
  assert.equal(listed.res.body.data.users[0]._id, "user-1");

  assert.equal((await invoke(controller.getUser, { params: { id: "invalid" } })).res.statusCode, 400);
  assert.equal((await invoke(controller.getUser, { params: { id: "507f1f77bcf86cd799439011" } })).res.statusCode, 200);
  assert.equal((await invoke(controller.getUser, { params: { id: "507f191e810c19729de860ea" } })).res.statusCode, 404);

  const validReq = { params: { id: "507f1f77bcf86cd799439011" } };
  assert.equal((await invoke(controller.blockUser, validReq)).res.body.message, "User blocked");
  assert.equal((await invoke(controller.unblockUser, validReq)).res.body.message, "User restored");
  assert.equal((await invoke(controller.blockUser, { params: { id: "invalid" } })).res.statusCode, 400);
  assert.equal((await invoke(controller.unblockUser, { params: { id: "507f191e810c19729de860ea" } })).res.statusCode, 404);
  assert.deepEqual(calls, [
    ["507f1f77bcf86cd799439011", true],
    ["507f1f77bcf86cd799439011", false],
    ["507f191e810c19729de860ea", false],
  ]);

  const failingController = createInternalAdminUserController({
    userRepository: {
      findAdminUsers: async () => { throw new Error("list failed"); },
      findAdminUserById: async () => { throw new Error("detail failed"); },
      updateAdminUserDeletedState: async () => { throw new Error("update failed"); },
    },
    userService: { getCurrentUser: (user) => user },
  });
  assert.match((await invoke(failingController.listUsers, { query: {} })).error.message, /list failed/);
  assert.match((await invoke(failingController.getUser, { params: { id: "507f1f77bcf86cd799439011" } })).error.message, /detail failed/);
  assert.match((await invoke(failingController.blockUser, { params: { id: "507f1f77bcf86cd799439011" } })).error.message, /update failed/);
  assert.match((await invoke(failingController.unblockUser, { params: { id: "507f1f77bcf86cd799439011" } })).error.message, /update failed/);
});

test("internal Admin stats controller produces metrics, clamps growth ranges, and forwards errors", async () => {
  const countFilters = [];
  let growthSince;
  const controller = createInternalAdminStatsController({
    userRepository: {
      countAdminUsers: async (filter) => {
        countFilters.push(filter);
        return countFilters.length;
      },
      getAdminUserGrowth: async (since) => {
        growthSince = since;
        return [{ _id: "2026-01-02", count: 3 }];
      },
    },
  });

  const stats = await invoke(controller.getStats, {});
  assert.equal(stats.res.body.data.totalUsers, 1);
  assert.equal(stats.res.body.data.newMenteesThisMonth, 6);
  assert.equal(countFilters.length, 6);

  for (const [days, minDays] of [["0", 1], ["999", 365], ["30", 30]]) {
    const before = Date.now();
    const result = await invoke(controller.getUserGrowth, { query: { days } });
    assert.equal(result.res.statusCode, 200);
    assert.deepEqual(result.res.body.data, [{ label: "Jan 2", count: 3 }]);
    assert.ok(growthSince.getTime() <= before - minDays * 86400000 + 1000);
  }

  const brokenController = createInternalAdminStatsController({
    userRepository: {
      countAdminUsers: async () => { throw new Error("database down"); },
      getAdminUserGrowth: async () => { throw new Error("database down"); },
    },
  });
  assert.match((await invoke(brokenController.getStats, {})).error.message, /database down/);
  assert.match((await invoke(brokenController.getUserGrowth, { query: {} })).error.message, /database down/);
});

test("refresh and user controllers forward requests and errors with their auth context", async () => {
  const refreshController = createRefreshController({
    sessionService: { refreshAccessToken: async (cookie) => ({ refreshed: cookie }) },
  });
  const refreshed = await invoke(refreshController.refreshToken, { cookies: { refreshToken: "refresh" } });
  assert.equal(refreshed.res.body.data.refreshed, "refresh");

  const userController = createUserController({
    authService: {
      addAccountRole: async (user, role, options) => ({ user: user._id, role, options }),
    },
    userService: { getCurrentUser: (user) => ({ _id: user._id }) },
  });
  const req = { user: { _id: "user-1" }, body: { role: "mentor" }, correlationId: "corr-1" };
  assert.deepEqual((await invoke(userController.addRole, req)).res.body.data, {
    user: "user-1",
    role: "mentor",
    options: { correlationId: "corr-1" },
  });

  const failingUserController = createUserController({
    authService: { addAccountRole: async () => { throw new Error("role failed"); } },
    userService: { getCurrentUser: () => { throw new Error("profile failed"); } },
  });
  assert.match((await invoke(failingUserController.addRole, req)).error.message, /role failed/);
  assert.match((await invoke(failingUserController.getMe, req)).error.message, /profile failed/);

  const failingRefresh = createRefreshController({
    sessionService: { refreshAccessToken: async () => { throw new Error("bad refresh"); } },
  });
  assert.match((await invoke(failingRefresh.refreshToken, {})).error.message, /bad refresh/);
});
