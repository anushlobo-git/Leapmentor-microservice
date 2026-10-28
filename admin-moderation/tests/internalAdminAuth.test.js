const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../app");
const createInternalServiceAuth = require("../middleware/internalServiceAuth");
const createInternalAdminAuthController = require("../controllers/internalAdminAuth.controller");
const createInternalAdminAuthRouter = require("../routes/internalAdminAuth.routes");

const start = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("Admin session validation checks tokenVersion and requires its internal service token", async () => {
  const secret = "admin-session-secret";
  const controller = createInternalAdminAuthController({
    adminUserRepository: {
      findAdminByIdFull: async () => ({
        _id: "admin-1",
        name: "Admin",
        isActive: true,
        tokenVersion: 4,
      }),
    },
    jwt,
    accessSecret: secret,
    toAdminDTO: (admin) => ({ _id: String(admin._id), name: admin.name }),
  });
  const serverDetails = await start({
    health: { isReady: () => true },
    internalServiceAuth: createInternalServiceAuth({
      serviceToken: "admin-service-token",
    }),
    internalAdminAuthRouter: createInternalAdminAuthRouter({ controller }),
  });
  try {
    const url = `${serverDetails.url}/internal/v1/admin-auth/validate-session`;
    const token = jwt.sign(
      { id: "admin-1", role: "admin", type: "access", tokenVersion: 4 },
      secret,
    );
    const unauthorized = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const valid = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-service-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
    assert.equal(unauthorized.status, 401);
    assert.deepEqual((await valid.json()).data.admin, {
      _id: "admin-1",
      name: "Admin",
    });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("rejects a signed Admin token with a stale tokenVersion", async () => {
  const secret = "admin-session-secret";
  const controller = createInternalAdminAuthController({
    adminUserRepository: {
      findAdminByIdFull: async () => ({
        _id: "admin-1",
        isActive: true,
        tokenVersion: 5,
      }),
    },
    jwt,
    accessSecret: secret,
    toAdminDTO: (admin) => ({ _id: String(admin._id) }),
  });
  const req = {
    body: {
      token: jwt.sign(
        { id: "admin-1", role: "admin", type: "access", tokenVersion: 4 },
        secret,
      ),
    },
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
  let forwardedError;
  await controller.validateSession(req, res, (error) => {
    forwardedError = error;
  });
  assert.equal(forwardedError.statusCode, 401);
  assert.equal(forwardedError.code, "SESSION_REVOKED");
});
