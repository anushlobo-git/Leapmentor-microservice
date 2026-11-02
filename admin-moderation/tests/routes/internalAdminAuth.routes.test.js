const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createInternalAdminAuthController = require("../../controllers/internalAdminAuth.controller");
const createInternalAdminAuthRouter = require("../../routes/internalAdminAuth.routes");

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

test("internal Admin session validation rejects malformed sessions and forwards repository failures", async () => {
  const admin = { _id: "admin-1", isActive: true };
  const buildController = ({
    decoded = { id: "admin-1", role: "admin", type: "access", tokenVersion: 0 },
    findAdminByIdFull = async () => admin,
  } = {}) => createInternalAdminAuthController({
    adminUserRepository: { findAdminByIdFull },
    jwt: {
      verify: (token) => {
        if (token === "invalid") throw new Error("expired");
        return decoded;
      },
    },
    accessSecret: "secret",
    toAdminDTO: (value) => ({ _id: value._id }),
  });
  const invoke = async (controller, token) => {
    let forwarded;
    await controller.validateSession(
      { body: token === undefined ? {} : { token } },
      { status: () => ({ json: (body) => body }) },
      (error) => { forwarded = error; },
    );
    return forwarded;
  };

  assert.equal((await invoke(buildController(), undefined)).code, "ADMIN_TOKEN_REQUIRED");
  assert.equal((await invoke(buildController(), "invalid")).code, "INVALID_ADMIN_TOKEN");
  assert.equal(
    (await invoke(buildController({ decoded: { id: "admin-1", role: "user", type: "access" } }), "token")).code,
    "INVALID_ADMIN_TOKEN",
  );
  assert.equal(
    (await invoke(buildController({ findAdminByIdFull: async () => null }), "token")).code,
    "ADMIN_NOT_FOUND",
  );
  assert.equal(
    (await invoke(buildController({ findAdminByIdFull: async () => ({ ...admin, isActive: false }) }), "token")).code,
    "ADMIN_INACTIVE",
  );

  let successBody;
  const successfulController = buildController();
  await successfulController.validateSession(
    { body: { token: "token" } },
    { status: (code) => ({ json: (body) => { successBody = { code, body }; } }) },
    assert.fail,
  );
  assert.deepEqual(successBody, {
    code: 200,
    body: { success: true, data: { admin: { _id: "admin-1" } } },
  });

  const repositoryError = await invoke(
    buildController({
      findAdminByIdFull: async () => { throw new Error("database unavailable"); },
    }),
    "token",
  );
  assert.match(repositoryError.message, /database unavailable/);
});

test("production admin container exposes internal session validation dependencies", () => {
  const container = require("../../container");

  assert.equal(typeof container.internalServiceAuth, "function");
  assert.equal(typeof container.internalAdminAuthRouter, "function");
});
