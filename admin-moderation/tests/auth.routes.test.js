const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../app");
const createAuthController = require("../controllers/auth.controller");
const createAuthRouter = require("../routes/auth.routes");
const createAdminAuthenticate = require("../middleware/adminAuthenticate");
const createRequireReady = require("../middleware/requireReady");
const { validateLogin } = require("../middleware/authValidation");

const ACCESS_SECRET = "route-access-secret";

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

const createTestContainer = ({ ready = true } = {}) => {
  const admin = {
    _id: "507f1f77bcf86cd799439011",
    name: "Root Admin",
    email: "root@example.com",
    isActive: true,
    tokenVersion: 2,
  };
  const adminUserRepository = {
    findAdminByIdFull: async () => admin,
  };
  const authRouter = createAuthRouter({
    controller: createAuthController({
      authService: {
        adminLogin: async () => ({
          accessToken: "access-token",
          refreshToken: "refresh-token",
          admin,
        }),
        refreshAdminToken: async () => ({
          accessToken: "new-access-token",
          refreshToken: "new-refresh-token",
        }),
        logout: async () => undefined,
      },
    }),
    authenticate: createAdminAuthenticate({
      adminUserRepository,
      jwt,
      accessSecret: ACCESS_SECRET,
      toAdminDTO: (value) => ({
        _id: value._id,
        email: value.email,
        isActive: value.isActive,
      }),
    }),
    validateLogin,
    requireReady: createRequireReady({ health: { isReady: () => ready } }),
  });

  return { health: { isReady: () => ready }, authRouter };
};

test("login preserves the admin cookie contract and response envelope", async () => {
  const { server, url } = await startServer(createTestContainer());

  try {
    const response = await fetch(`${url}/api/v1/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "root@example.com", password: "password123" }),
    });
    const body = await response.json();
    const cookies = response.headers.get("set-cookie");

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      success: true,
      data: { admin: {
        _id: "507f1f77bcf86cd799439011",
        name: "Root Admin",
        email: "root@example.com",
        isActive: true,
        tokenVersion: 2,
      } },
      message: "Admin login successful",
    });
    assert.match(cookies, /adminToken=access-token/);
    assert.match(cookies, /adminRefreshToken=refresh-token/);
    assert.match(cookies, /Path=\/api\/v1\/admin\/auth/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("login rejects malformed credentials before calling the service", async () => {
  const { server, url } = await startServer(createTestContainer());

  try {
    const response = await fetch(`${url}/api/v1/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "short" }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.code, "INVALID_ADMIN_LOGIN");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("me rejects a missing cookie and accepts an active, non-revoked admin", async () => {
  const { server, url } = await startServer(createTestContainer());

  try {
    const missing = await fetch(`${url}/api/v1/admin/auth/me`);
    assert.equal(missing.status, 401);

    const token = jwt.sign(
      { id: "507f1f77bcf86cd799439011", role: "admin", type: "access", tokenVersion: 2 },
      ACCESS_SECRET,
    );
    const response = await fetch(`${url}/api/v1/admin/auth/me`, {
      headers: { Cookie: `adminToken=${token}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.admin.email, "root@example.com");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("all stateful admin auth routes return 503 when Mongo persistence is unavailable", async () => {
  const { server, url } = await startServer(createTestContainer({ ready: false }));

  try {
    const response = await fetch(`${url}/api/v1/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "root@example.com", password: "password123" }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.code, "SERVICE_NOT_READY");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
