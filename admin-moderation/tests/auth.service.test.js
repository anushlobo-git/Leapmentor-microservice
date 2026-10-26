const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createAdminAuthService = require("../services/auth.service");

const ACCESS_SECRET = "admin-access-test-secret";
const REFRESH_SECRET = "admin-refresh-test-secret";

const createFixture = () => {
  const admin = {
    _id: "507f1f77bcf86cd799439011",
    name: "Root Admin",
    email: "root@example.com",
    isActive: true,
    isSuperAdmin: true,
    tokenVersion: 0,
    comparePassword: async (candidate) => candidate === "password123",
    save: async () => admin,
  };
  const repository = {
    findAdminByEmail: async () => admin,
    findAdminByIdFull: async () => admin,
    saveAdmin: async (value) => value,
    incrementTokenVersion: async () => admin,
  };
  const service = createAdminAuthService({
    adminUserRepository: repository,
    jwt,
    toAdminDTO: (value) => ({
      _id: value._id,
      email: value.email,
      isActive: value.isActive,
    }),
    accessSecret: ACCESS_SECRET,
    refreshSecret: REFRESH_SECRET,
  });

  return { admin, repository, service };
};

test("admin login verifies the password, records last login, and issues paired tokens", async () => {
  const { admin, service } = createFixture();

  const result = await service.adminLogin({
    email: " ROOT@example.com ",
    password: "password123",
  });

  assert.ok(admin.lastLoginAt instanceof Date);
  assert.deepEqual(result.admin, {
    _id: admin._id,
    email: admin.email,
    isActive: true,
  });
  assert.equal(jwt.verify(result.accessToken, ACCESS_SECRET).type, "access");
  assert.equal(jwt.verify(result.refreshToken, REFRESH_SECRET).type, "refresh");
});

test("admin login rejects an inactive administrator before password verification", async () => {
  const { admin, service } = createFixture();
  admin.isActive = false;

  await assert.rejects(
    service.adminLogin({ email: admin.email, password: "password123" }),
    (error) => error.statusCode === 403 && error.code === "ADMIN_INACTIVE",
  );
});

test("refresh rejects a token after tokenVersion is bumped", async () => {
  const { admin, service } = createFixture();
  admin.tokenVersion = 1;
  const refreshToken = jwt.sign(
    { id: admin._id, role: "admin", type: "refresh", tokenVersion: 0 },
    REFRESH_SECRET,
  );

  await assert.rejects(
    service.refreshAdminToken(refreshToken),
    (error) => error.statusCode === 401 && error.code === "SESSION_REVOKED",
  );
});

test("logout increments tokenVersion and is idempotent for an invalid token", async () => {
  const { repository, service } = createFixture();
  let incrementedId = null;
  repository.incrementTokenVersion = async (id) => {
    incrementedId = id;
  };

  const refreshToken = jwt.sign(
    { id: "admin-1", role: "admin", type: "refresh", tokenVersion: 0 },
    REFRESH_SECRET,
  );
  await service.logout(refreshToken);
  await service.logout("invalid-token");

  assert.equal(incrementedId, "admin-1");
});
