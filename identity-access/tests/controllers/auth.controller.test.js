const test = require("node:test");
const assert = require("node:assert/strict");

const createAuthController = require("../../controllers/auth.controller");

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

const call = async (handler, req) => {
  const res = response();
  let error;
  await handler(req, res, (value) => { error = value; });
  return { res, error };
};

test("registration maps every outcome to its contract and sets refresh cookies when provided", async () => {
  const outcomes = [
    ["created", 201, "Registered successfully", true],
    ["role_added", 200, "Role added to your account", true],
    ["already_registered", 200, "You already have an account for this role", false],
    ["login_required", 200, "An account with this email already exists", false],
  ];
  let index = 0;
  const controller = createAuthController({
    authService: {
      registerUser: async (_body, options) => {
        assert.deepEqual(options, { correlationId: "corr-auth" });
        const [outcome, , , hasRefresh] = outcomes[index++];
        return {
          outcome,
          isNewUser: outcome === "created",
          loggedIn: outcome === "created" || outcome === "role_added",
          user: { _id: "user-1" },
          email: "ada@example.com",
          accessToken: "access",
          ...(hasRefresh ? { refreshToken: "refresh" } : {}),
        };
      },
    },
  });

  for (const [outcome, expectedStatus, message, hasRefresh] of outcomes) {
    const { res, error } = await call(controller.register, {
      body: { name: "Ada" },
      correlationId: "corr-auth",
    });
    assert.equal(error, undefined);
    assert.equal(res.statusCode, expectedStatus);
    assert.equal(res.body.message, message);
    assert.equal(res.body.data.outcome, outcome);
    assert.equal(res.cookies.length, hasRefresh ? 1 : 0);
  }
});

test("login and logout use cookie-service hooks when available and fallback response cookies otherwise", async () => {
  const hookedCalls = [];
  const hookedController = createAuthController({
    authService: {
      loginUser: async () => ({
        user: { _id: "user-1" },
        accessToken: "access",
        refreshToken: "refresh",
      }),
    },
    cookieService: {
      setRefreshCookie: (_res, token) => hookedCalls.push(["set", token]),
      clearRefreshCookie: () => hookedCalls.push(["clear"]),
    },
  });
  const login = await call(hookedController.login, { body: { email: "ada@example.com" } });
  assert.equal(login.res.statusCode, 200);
  assert.deepEqual(hookedCalls, [["set", "refresh"]]);
  await hookedController.logout({}, response(), assert.fail);
  assert.deepEqual(hookedCalls, [["set", "refresh"], ["clear"]]);

  const fallbackController = createAuthController({
    authService: {
      loginUser: async () => ({
        user: { _id: "user-2" },
        accessToken: "access",
        refreshToken: "refresh-fallback",
      }),
    },
  });
  const fallbackLogin = await call(fallbackController.login, { body: {} });
  assert.equal(fallbackLogin.res.cookies[0][0], "refreshToken");
  assert.equal(fallbackLogin.res.cookies[0][1], "refresh-fallback");
  const fallbackLogoutRes = response();
  await fallbackController.logout({}, fallbackLogoutRes, assert.fail);
  assert.deepEqual(fallbackLogoutRes.clearedCookies, [["refreshToken"]]);
});

test("auth controller forwards service and response-hook errors", async () => {
  const controller = createAuthController({
    authService: {
      registerUser: async () => { throw new Error("register failed"); },
      loginUser: async () => { throw new Error("login failed"); },
    },
    cookieService: {
      clearRefreshCookie: () => { throw new Error("cookie failed"); },
    },
  });
  assert.match((await call(controller.register, { body: {} })).error.message, /register failed/);
  assert.match((await call(controller.login, { body: {} })).error.message, /login failed/);
  assert.match((await call(controller.logout, {})).error.message, /cookie failed/);
});
