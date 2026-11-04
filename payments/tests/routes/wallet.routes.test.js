const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createWalletController = require("../../controllers/wallet.controller");
const createInternalWalletRouter = require("../../routes/internalWallet.routes");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createAuthenticate = require("../../middleware/authenticate");
const createWalletRouter = require("../../routes/wallet.routes");
const jwt = require("jsonwebtoken");

const startTestServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
};

test("wallet provisioning route requires internal service authentication", async () => {
  const walletController = createWalletController({
    walletService: {
      provisionWallets: async () => ({
        created: true,
        response: { provisioningStatus: "complete" },
      }),
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    internalServiceAuth: createInternalServiceAuth({
      serviceToken: "payments-token",
    }),
    internalWalletRouter: createInternalWalletRouter({ walletController }),
  });

  try {
    const response = await fetch(
      `${serverDetails.url}/internal/v1/wallets/provision`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "wallet-user-123",
        },
        body: JSON.stringify({ userId: "user-123", roles: ["mentee"] }),
      },
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Invalid internal service credentials",
      code: "INVALID_INTERNAL_AUTH",
    });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("wallet provisioning route forwards an authenticated request", async () => {
  const calls = [];
  const walletController = createWalletController({
    walletService: {
      provisionWallets: async (input) => {
        calls.push(input);
        return {
          created: true,
          response: { provisioningStatus: "complete" },
        };
      },
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    internalServiceAuth: createInternalServiceAuth({
      serviceToken: "payments-token",
    }),
    internalWalletRouter: createInternalWalletRouter({ walletController }),
  });

  try {
    const response = await fetch(
      `${serverDetails.url}/internal/v1/wallets/provision`,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer payments-token",
          "Content-Type": "application/json",
          "Idempotency-Key": "wallet-user-123",
        },
        body: JSON.stringify({ userId: "user-123", roles: ["mentee"] }),
      },
    );

    assert.equal(response.status, 201);
    assert.deepEqual(calls, [
      {
        userId: "user-123",
        roles: ["mentee"],
        idempotencyKey: "wallet-user-123",
      },
    ]);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("public wallet route authenticates the browser token and returns the mentee wallet", async () => {
  const walletController = createWalletController({
    walletService: {
      provisionWallets: async () => ({ created: true, response: {} }),
      getMyWallet: async (userId) => {
        assert.equal(userId, "user-123");
        return { balance: 500, escrow: 25 };
      },
    },
  });
  const serverDetails = await startTestServer({
    health: { isReady: () => true },
    walletRouter: createWalletRouter({
      walletController,
      authenticate: createAuthenticate({ accessSecret: "test-secret" }),
    }),
  });

  try {
    const token = jwt.sign({ id: "user-123", type: "access" }, "test-secret");
    const response = await fetch(`${serverDetails.url}/api/v1/escrow/wallet`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, {
      balance: 500,
      escrow: 25,
    });
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
