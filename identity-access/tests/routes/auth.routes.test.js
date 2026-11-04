const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createAuthController = require("../../controllers/auth.controller");
const createAuthRouter = require("../../routes/auth.routes");

const startTestServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

const createTestAuthRouter = (authController, refreshController = {}) =>
  createAuthRouter({
    authController,
    refreshController: {
      refreshToken: async (req, res, next) => {
        if (refreshController.refreshToken) {
          return refreshController.refreshToken(req, res, next);
        }
        return res.status(501).json({ error: "not implemented" });
      },
    },
    cookieService: {
      clearRefreshCookie: (res) => res.clearCookie("refreshToken"),
    },
  });

test("registration route returns the extracted registration contract", async () => {
  const authController = createAuthController({
    authService: {
      registerUser: async (_body, { correlationId }) => ({
        outcome: "created",
        isNewUser: true,
        loggedIn: false,
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: { _id: "user-1", walletProvisioningStatus: "complete" },
        correlationId,
      }),
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    authRouter: createTestAuthRouter(authController),
  });

  try {
    const response = await fetch(
      `${serverDetails.url}/api/v1/auth/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-ID": "corr-route-1",
        },
        body: JSON.stringify({
          name: "Jane Doe",
          email: "jane@example.com",
          password: "password123",
          roles: ["mentee"],
          termsAccepted: true,
        }),
      },
    );

    const body = await response.json();
    assert.equal(response.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.outcome, "created");
    assert.equal(response.headers.get("x-correlation-id"), "corr-route-1");
    assert.match(response.headers.get("set-cookie"), /refreshToken=refresh-token/);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("registration route returns 503 when persistence is not ready", async () => {
  const serverDetails = await startTestServer({
    health: { isReady: () => false },
    authRouter: createTestAuthRouter(
      createAuthController({
        authService: { registerUser: async () => ({}) },
      }),
    ),
  });

  try {
    const response = await fetch(
      `${serverDetails.url}/api/v1/auth/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "Identity persistence is not ready",
      code: "SERVICE_NOT_READY",
    });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("login route returns the access token and refresh cookie", async () => {
  const authController = createAuthController({
    authService: {
      loginUser: async () => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: { _id: "user-1", roles: ["mentee"] },
      }),
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    authRouter: createTestAuthRouter(authController),
  });

  try {
    const response = await fetch(`${serverDetails.url}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "jane@example.com",
        password: "password123",
      }),
    });

    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.accessToken, "access-token");
    assert.deepEqual(body.data.user.roles, ["mentee"]);
    assert.match(response.headers.get("set-cookie"), /refreshToken=refresh-token/);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("login route exposes the unverified-email compatibility fields", async () => {
  const authController = createAuthController({
    authService: {
      loginUser: async () => {
        const error = new Error("Please verify your email address to log in.");
        error.statusCode = 403;
        error.code = "EMAIL_NOT_VERIFIED";
        error.isEmailVerified = false;
        error.email = "jane@example.com";
        throw error;
      },
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    authRouter: createTestAuthRouter(authController),
  });

  try {
    const response = await fetch(`${serverDetails.url}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "jane@example.com", password: "password123" }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      success: false,
      data: null,
      message: "Please verify your email address to log in.",
      error: "Please verify your email address to log in.",
      code: "EMAIL_NOT_VERIFIED",
      isEmailVerified: false,
      email: "jane@example.com",
    });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("refresh route returns a new access token and user DTO", async () => {
  const authController = createAuthController({ authService: {} });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    authRouter: createTestAuthRouter(authController, {
      refreshToken: async (_req, res) =>
        res.status(200).json({
          success: true,
          data: {
            accessToken: "new-access-token",
            user: { _id: "user-1", roles: ["mentee"] },
          },
          message: "Access token refreshed",
        }),
    }),
  });

  try {
    const response = await fetch(`${serverDetails.url}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { Cookie: "refreshToken=refresh-token" },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.accessToken, "new-access-token");
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("logout route clears the refresh cookie", async () => {
  const authController = createAuthController({ authService: {} });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    authRouter: createTestAuthRouter(authController),
  });

  try {
    const response = await fetch(`${serverDetails.url}/api/v1/auth/logout`, {
      method: "POST",
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, "Logged out successfully");
    assert.match(response.headers.get("set-cookie"), /refreshToken=/);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("logout remains available when Identity persistence is not ready", async () => {
  const authController = createAuthController({
    authService: {},
    cookieService: {
      clearRefreshCookie: (res) => res.clearCookie("refreshToken"),
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => false },
    authController,
    authRouter: createTestAuthRouter(authController),
  });

  try {
    const response = await fetch(`${serverDetails.url}/api/v1/auth/logout`, {
      method: "POST",
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message, "Logged out successfully");
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("social authentication routes preserve the public OAuth paths", async () => {
  const authController = createAuthController({ authService: {} });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    authController,
    authRouter: createAuthRouter({
      authController,
      refreshController: {
        refreshToken: (_req, res) => res.status(501).json({ error: "not implemented" }),
      },
      cookieService: { clearRefreshCookie: (res) => res.clearCookie("refreshToken") },
      oauthController: {
        google: (_req, res) => res.status(200).json({ provider: "google" }),
        social: (_req, res) => res.status(200).json({ provider: "social" }),
        linkedinRedirect: (_req, res) => res.redirect("https://linkedin.example"),
        linkedinCallback: (_req, res) => res.redirect("http://frontend.example"),
        linkedinToken: (_req, res) => res.status(200).json({ provider: "linkedin" }),
      },
    }),
  });

  try {
    const google = await fetch(`${serverDetails.url}/api/v1/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: "credential" }),
    });
    const linkedin = await fetch(`${serverDetails.url}/api/v1/auth/linkedin/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "code" }),
    });
    const redirect = await fetch(`${serverDetails.url}/api/v1/auth/linkedin`, {
      redirect: "manual",
    });

    assert.equal(google.status, 200);
    assert.equal((await google.json()).provider, "google");
    assert.equal(linkedin.status, 200);
    assert.equal((await linkedin.json()).provider, "linkedin");
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get("location"), "https://linkedin.example");
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
