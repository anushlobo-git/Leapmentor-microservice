const test = require("node:test");
const assert = require("node:assert/strict");

const createWalletService = require("../../services/wallet.service");

const createFakes = () => {
  const wallets = new Map();
  const idempotency = new Map();
  const transactions = [];

  const walletRepository = {
    findWalletByUserAndRole: async (userId, role) =>
      wallets.get(`${userId}:${role}`) || null,
    createWallet: async (data) => {
      const wallet = {
        _id: `${data.user}-${data.role}`,
        ...data,
        createdAt: "now",
        updatedAt: "now",
      };
      wallets.set(`${data.user}:${data.role}`, wallet);
      return wallet;
    },
  };

  const transactionRepository = {
    createTransaction: async (data) => {
      transactions.push(data);
      return data;
    },
  };

  const idempotencyRepository = {
    findByKey: async (key) => idempotency.get(key) || null,
    createPending: async (data) => {
      if (idempotency.has(data.key)) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      const record = { ...data, status: "pending", responseBody: null };
      idempotency.set(data.key, record);
      return record;
    },
    markSucceeded: async (key, responseBody) => {
      const record = idempotency.get(key);
      record.status = "succeeded";
      record.responseBody = responseBody;
      return record;
    },
    deletePending: async (key) => idempotency.delete(key),
  };

  return {
    walletRepository,
    transactionRepository,
    idempotencyRepository,
    transactions,
  };
};

test("provisions role wallets and records the mentee welcome credit", async () => {
  const fakes = createFakes();
  const service = createWalletService({
    ...fakes,
    runInTransaction: (work) => work(null),
    logger: { info() {} },
  });

  const result = await service.provisionWallets({
    userId: "user-123",
    roles: ["mentee", "mentor"],
    idempotencyKey: "wallet-user-123",
  });

  assert.equal(result.created, true);
  assert.equal(result.response.provisioningStatus, "complete");
  assert.equal(result.response.wallets.length, 2);
  assert.equal(
    result.response.wallets.find((wallet) => wallet.role === "mentee").balance,
    500,
  );
  assert.equal(fakes.transactions.length, 1);
  assert.equal(fakes.transactions[0].type, "credit");
});

test("returns the stored response for an idempotent retry", async () => {
  const fakes = createFakes();
  const service = createWalletService({
    ...fakes,
    runInTransaction: (work) => work(null),
    logger: { info() {} },
  });

  const first = await service.provisionWallets({
    userId: "user-123",
    roles: ["mentee"],
    idempotencyKey: "wallet-user-123",
  });
  const second = await service.provisionWallets({
    userId: "user-123",
    roles: ["mentee"],
    idempotencyKey: "wallet-user-123",
  });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.deepEqual(second.response, first.response);
  assert.equal(fakes.transactions.length, 1);
});

test("rejects reusing an idempotency key for different input", async () => {
  const fakes = createFakes();
  const service = createWalletService({
    ...fakes,
    runInTransaction: (work) => work(null),
    logger: { info() {} },
  });

  await service.provisionWallets({
    userId: "user-123",
    roles: ["mentee"],
    idempotencyKey: "wallet-user-123",
  });

  await assert.rejects(
    () =>
      service.provisionWallets({
        userId: "user-123",
        roles: ["mentor"],
        idempotencyKey: "wallet-user-123",
      }),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, "IDEMPOTENCY_KEY_REUSED");
      return true;
    },
  );
});

test("reads the mentee wallet without accidentally selecting a mentor wallet", async () => {
  const calls = [];
  const fakes = createFakes();
  fakes.walletRepository.findWalletByUserAndRole = async (userId, role) => {
    calls.push([userId, role]);
    return { balance: 420, escrow: 80 };
  };
  const service = createWalletService({
    ...fakes,
    runInTransaction: (work) => work(null),
    logger: { info() {} },
  });

  assert.deepEqual(await service.getMyWallet("user-123"), {
    balance: 420,
    escrow: 80,
  });
  assert.deepEqual(calls, [["user-123", "mentee"]]);
});

test("returns a stable not-found error when the mentee wallet is missing", async () => {
  const fakes = createFakes();
  const service = createWalletService({
    ...fakes,
    runInTransaction: (work) => work(null),
    logger: { info() {} },
  });

  await assert.rejects(service.getMyWallet("missing-user"), {
    statusCode: 404,
    code: "WALLET_NOT_FOUND",
  });
});
