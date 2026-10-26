const test = require("node:test");
const assert = require("node:assert/strict");

const createFederatedAuthService = require("../../services/federatedAuth.service");

const createFakes = ({ paymentsError = null } = {}) => {
  const users = [];
  const oauthAccounts = [];
  const statusUpdates = [];
  const userRepository = {
    findUserByEmail: async (email) =>
      users.find((user) => user.email === email) || null,
    createUser: async (data) => {
      const user = { _id: `user-${users.length + 1}`, ...data };
      users.push(user);
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
  const oauthAccountRepository = {
    findOAuthAccountWithUser: async (provider, providerId) =>
      oauthAccounts.find(
        (account) =>
          account.provider === provider && account.providerId === providerId,
      ) || null,
    createOAuthAccount: async (data) => {
      const account = { _id: `oauth-${oauthAccounts.length + 1}`, ...data };
      oauthAccounts.push({ ...account, user: users.find((u) => u._id === data.user) || data.user });
      return account;
    },
  };
  return {
    users,
    oauthAccounts,
    statusUpdates,
    userRepository,
    oauthAccountRepository,
    paymentsClient: {
      provisionWallet: async () => {
        if (paymentsError) throw paymentsError;
        return { provisioningStatus: "complete" };
      },
    },
    tokenService: {
      signAccessToken: (userId) => `access:${userId}`,
      signRefreshToken: (userId) => `refresh:${userId}`,
    },
  };
};

test("authenticates an existing OAuth mapping without requiring terms", async () => {
  const fakes = createFakes();
  const user = {
    _id: "existing-user",
    email: "jane@example.com",
    name: "Jane",
    roles: ["mentee"],
    isEmailVerified: true,
    walletProvisioningStatus: "complete",
  };
  fakes.users.push(user);
  fakes.oauthAccounts.push({
    provider: "linkedin",
    providerId: "linkedin-1",
    user,
  });
  const service = createFederatedAuthService({ ...fakes });

  const result = await service.socialAuthUser({
    provider: "linkedin",
    providerId: "linkedin-1",
  });

  assert.equal(result.isNewUser, false);
  assert.equal(result.accessToken, "access:existing-user");
  assert.equal(fakes.users.length, 1);
});

test("links a new provider identity to an existing email account", async () => {
  const fakes = createFakes();
  const user = {
    _id: "existing-user",
    email: "jane@example.com",
    name: "Jane",
    roles: ["mentor"],
    isEmailVerified: true,
  };
  fakes.users.push(user);
  const service = createFederatedAuthService({ ...fakes });

  const result = await service.socialAuthUser({
    provider: "apple",
    providerId: "apple-1",
    email: "JANE@example.com",
    name: "Different Name",
  });

  assert.equal(result.isNewUser, false);
  assert.deepEqual(
    {
      provider: fakes.oauthAccounts[0].provider,
      providerId: fakes.oauthAccounts[0].providerId,
      user: fakes.oauthAccounts[0].user,
    },
    { provider: "apple", providerId: "apple-1", user },
  );
});

test("creates a new federated user, provisions the wallet, and links OAuth", async () => {
  const fakes = createFakes();
  const service = createFederatedAuthService({
    ...fakes,
    logger: { info() {}, error() {} },
  });

  const result = await service.authenticateFederatedUser(
    {
      provider: "google",
      providerId: "google-1",
      email: "new@example.com",
      name: "New User",
      roles: ["mentor"],
      termsAccepted: true,
      emailVerified: true,
    },
    { correlationId: "corr-social-1" },
  );

  assert.equal(result.isNewUser, true);
  assert.deepEqual(result.user.roles, ["mentor"]);
  assert.equal(fakes.users[0].walletProvisioningStatus, "complete");
  assert.deepEqual(
    fakes.statusUpdates.map(({ status }) => status),
    ["pending", "complete"],
  );
});

test("requires terms only when a new federated account must be created", async () => {
  const fakes = createFakes();
  const service = createFederatedAuthService({ ...fakes });

  await assert.rejects(
    () =>
      service.authenticateFederatedUser({
        provider: "google",
        providerId: "google-2",
        email: "new@example.com",
        roles: ["mentee"],
        termsAccepted: false,
      }),
    { statusCode: 400, code: "TERMS_NOT_ACCEPTED" },
  );
});

test("leaves a recoverable failed wallet status when Payments is unavailable", async () => {
  const fakes = createFakes({ paymentsError: new Error("Payments unavailable") });
  const service = createFederatedAuthService({
    ...fakes,
    logger: { info() {}, error() {} },
  });

  await assert.rejects(
    () =>
      service.authenticateFederatedUser({
        provider: "linkedin",
        providerId: "linkedin-2",
        email: "new@example.com",
        termsAccepted: true,
      }),
    { statusCode: 503, code: "WALLET_PROVISIONING_PENDING" },
  );
  assert.equal(fakes.users[0].walletProvisioningStatus, "failed");
});

test("rejects unsupported generic providers", async () => {
  const service = createFederatedAuthService(createFakes());
  await assert.rejects(
    () =>
      service.socialAuthUser({
        provider: "github",
        providerId: "github-1",
        email: "user@example.com",
      }),
    { statusCode: 400, code: "INVALID_PROVIDER" },
  );
});
