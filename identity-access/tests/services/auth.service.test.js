const test = require("node:test");
const assert = require("node:assert/strict");

const createAuthService = require("../../services/auth.service");

const createFakes = ({ paymentsError = null } = {}) => {
  const users = [];
  const statusUpdates = [];

  const userRepository = {
    findUserByEmailWithPassword: async (email) =>
      users.find((user) => user.email === email) || null,
    createUser: async (data) => {
      const user = {
        _id: `user-${users.length + 1}`,
        ...data,
        createdAt: "now",
        updatedAt: "now",
      };
      users.push(user);
      return user;
    },
    addRoleToUser: async (userId, role) => {
      const user = users.find((candidate) => candidate._id === userId);
      user.roles = [...new Set([...user.roles, role])];
      return user;
    },
    updateWalletProvisioningStatus: async (userId, status, error) => {
      const user = users.find((candidate) => candidate._id === userId);
      user.walletProvisioningStatus = status;
      user.walletProvisioningError = error;
      statusUpdates.push({ userId, status, error });
      return user;
    },
  };

  const paymentsClient = {
    provisionWallet: async () => {
      if (paymentsError) throw paymentsError;
      return { provisioningStatus: "complete" };
    },
  };

  const bcrypt = {
    hash: async (password) => `hash:${password}`,
    compare: async (password, hash) => hash === `hash:${password}`,
  };

  const tokenService = {
    signAccessToken: (userId) => `access:${userId}`,
    signRefreshToken: (userId) => `refresh:${userId}`,
  };

  return {
    users,
    statusUpdates,
    userRepository,
    paymentsClient,
    bcrypt,
    tokenService,
  };
};

test("registers a new user only after wallet provisioning succeeds", async () => {
  const fakes = createFakes();
  const service = createAuthService({
    ...fakes,
    logger: { error() {} },
  });

  const result = await service.registerUser(
    {
      name: "Jane Doe",
      email: "Jane@Example.com",
      password: "password123",
      roles: ["mentee"],
      termsAccepted: true,
    },
    { correlationId: "corr-1" },
  );

  assert.equal(result.outcome, "created");
  assert.equal(result.accessToken, "access:user-1");
  assert.equal(result.user.walletProvisioningStatus, "complete");
  assert.equal(fakes.users[0].email, "jane@example.com");
  assert.deepEqual(
    fakes.statusUpdates.map(({ status }) => status),
    ["pending", "complete"],
  );
});

test("keeps the user recoverable when Payments is unavailable", async () => {
  const fakes = createFakes({
    paymentsError: new Error("Payments unavailable"),
  });
  const service = createAuthService({
    ...fakes,
    logger: { error() {} },
  });

  await assert.rejects(
    () =>
      service.registerUser({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
        roles: ["mentee"],
        termsAccepted: true,
      }),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, "WALLET_PROVISIONING_PENDING");
      return true;
    },
  );

  assert.equal(fakes.users.length, 1);
  assert.equal(fakes.users[0].walletProvisioningStatus, "failed");
  assert.equal(fakes.users[0].walletProvisioningError, "Payments unavailable");
});

test("returns login_required without changing an account for a wrong password", async () => {
  const fakes = createFakes();
  fakes.users.push({
    _id: "existing-user",
    email: "jane@example.com",
    password: "hash:correct-password",
    roles: ["mentee"],
    isEmailVerified: false,
    walletProvisioningStatus: "complete",
  });
  const service = createAuthService({
    ...fakes,
    logger: { error() {} },
  });

  const result = await service.registerUser({
    name: "Jane Doe",
    email: "jane@example.com",
    password: "wrong-password",
    roles: ["mentee"],
    termsAccepted: true,
  });

  assert.equal(result.outcome, "login_required");
  assert.equal(fakes.statusUpdates.length, 0);
});

test("login authenticates a verified user without contacting Payments", async () => {
  const fakes = createFakes({ paymentsError: new Error("Payments is offline") });
  fakes.users.push({
    _id: "existing-user",
    email: "jane@example.com",
    password: "hash:password123",
    roles: ["mentee", "mentor"],
    isEmailVerified: true,
    walletProvisioningStatus: "complete",
  });
  const service = createAuthService({ ...fakes, logger: { error() {} } });

  const result = await service.loginUser({
    email: " Jane@Example.com ",
    password: "password123",
  });
  assert.equal(result.accessToken, "access:existing-user");
  assert.equal(result.refreshToken, "refresh:existing-user");
  assert.deepEqual(result.user.roles, ["mentee", "mentor"]);
  assert.equal(result.user.password, undefined);
  assert.equal(fakes.statusUpdates.length, 0);
});

test("login rejects unverified users before wallet recovery or token issuance", async () => {
  const fakes = createFakes();
  fakes.users.push({
    _id: "existing-user", email: "jane@example.com", password: "hash:password123",
    roles: ["mentee"], isEmailVerified: false, walletProvisioningStatus: "failed",
  });
  fakes.tokenService.signAccessToken = () => assert.fail("No token may be issued");
  const service = createAuthService({ ...fakes, logger: { error() {} } });
  await assert.rejects(
    () => service.loginUser({ email: "jane@example.com", password: "password123" }),
    { statusCode: 403, message: "Please verify your email address to log in." },
  );
  assert.equal(fakes.statusUpdates.length, 0);
});

test("login rejects unknown credentials without revealing whether the user exists", async () => {
  const fakes = createFakes();
  const service = createAuthService({ ...fakes, logger: { error() {} } });

  await assert.rejects(
    () => service.loginUser({ email: "missing@example.com", password: "password123" }),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "INVALID_CREDENTIALS");
      return true;
    },
  );
});

test("adds a missing role and provisions the corresponding wallet", async () => {
  const fakes = createFakes();
  const currentUser = {
    _id: "user-1",
    roles: ["mentee"],
    walletProvisioningStatus: "complete",
  };
  fakes.users.push(currentUser);
  const service = createAuthService({ ...fakes, logger: { error() {} } });

  const result = await service.addAccountRole(currentUser, "mentor", {
    correlationId: "corr-role-1",
  });

  assert.deepEqual(result.roles, ["mentee", "mentor"]);
  assert.deepEqual(fakes.statusUpdates.map(({ status }) => status), [
    "pending",
    "complete",
  ]);
});

test("rejects adding a role the account already has", async () => {
  const fakes = createFakes();
  const currentUser = {
    _id: "user-1",
    roles: ["mentee"],
    walletProvisioningStatus: "complete",
  };
  const service = createAuthService({ ...fakes, logger: { error() {} } });

  await assert.rejects(
    () => service.addAccountRole(currentUser, "mentee"),
    { statusCode: 409, code: "ROLE_ALREADY_EXISTS" },
  );
});

test("retries wallet provisioning when a role was already added but Payments failed", async () => {
  const fakes = createFakes();
  const currentUser = {
    _id: "user-1",
    roles: ["mentee", "mentor"],
    walletProvisioningStatus: "failed",
  };
  fakes.users.push(currentUser);
  const service = createAuthService({ ...fakes, logger: { error() {} } });

  const result = await service.addAccountRole(currentUser, "mentor");
  assert.deepEqual(result.roles, ["mentee", "mentor"]);
  assert.equal(result.walletProvisioningStatus, "complete");
});
