const test = require("node:test");
const assert = require("node:assert/strict");

const createEarningsService = require("../../services/earnings.service");

const build = ({ balance = 90, completed = [], ongoing = [] } = {}) => {
  const transactions = [];
  const calls = [];
  const idempotency = new Map();
  const service = createEarningsService({
    workspaceClient: {
      getMentorRating: async (id) => ({ userId: id, avgRating: 4.5 }),
      getMentorSessions: async (_id, query) =>
        query.status === "ongoing" ? ongoing : completed,
      getMentorPayouts: async () => ({
        payouts: [],
        pagination: { currentPage: 1, totalPages: 0 },
      }),
    },
    walletRepository: {
      findWalletByUserAndRole: async (_id, role) =>
        role === "mentor" ? { balance } : null,
      findByUserIdAndRole: async (_id, role) =>
        role === "mentor"
          ? { balance, save: async () => calls.push("save") }
          : null,
      save: async (wallet) => {
        calls.push(["balance", wallet.balance]);
      },
    },
    transactionRepository: {
      createMany: async (entries) => transactions.push(...entries),
    },
    idempotencyRepository: {
      findByKey: async (key) => idempotency.get(key) || null,
      createPending: async (record) => {
        if (idempotency.has(record.key)) {
          const error = new Error("duplicate key");
          error.code = 11000;
          throw error;
        }
        idempotency.set(record.key, { ...record, status: "pending" });
      },
      markSucceeded: async (key, responseBody) => {
        idempotency.set(key, { ...idempotency.get(key), status: "succeeded", responseBody });
      },
      deletePending: async (key) => idempotency.delete(key),
    },
    runInTransaction: (work) => work(null),
  });
  return { service, transactions, calls, idempotency };
};

test("aggregates completed earnings, ongoing payout, rating, and mentor wallet balance", async () => {
  const { service } = build({
    completed: [{ totalAmount: 120 }],
    ongoing: [{ mentorPayout: 80 }],
  });
  assert.deepEqual(await service.getEarningsSummaryService("mentor-1"), {
    totalEarnings: 120,
    sessionsThisMonth: 0,
    avgRating: 4.5,
    pendingPayout: 80,
    walletBalance: 90,
  });
});

test("withdraws the mentor wallet and records the balance-zeroing ledger entry", async () => {
  const { service, transactions, calls } = build({ balance: 75 });
  assert.deepEqual(await service.withdrawEarningsService("mentor-1", "withdrawal-1"), {
    withdrawn: 75,
    newBalance: 0,
  });
  assert.deepEqual(calls, [["balance", 0]]);
  assert.equal(transactions[0].type, "withdrawal");
  assert.equal(transactions[0].amount, 75);
});

test("refuses withdrawal for a mentor with no available wallet balance", async () => {
  const { service, transactions } = build({ balance: 0 });
  await assert.rejects(service.withdrawEarningsService("mentor-1", "withdrawal-2"), {
    statusCode: 400,
    code: "NO_EARNINGS_TO_WITHDRAW",
  });
  assert.equal(transactions.length, 0);
});

test("returns the original withdrawal response for an idempotent retry", async () => {
  const { service, transactions, idempotency } = build({ balance: 75 });
  const first = await service.withdrawEarningsService("mentor-1", "withdrawal-3");
  const second = await service.withdrawEarningsService("mentor-1", "withdrawal-3");
  assert.deepEqual(second, first);
  assert.equal(transactions.length, 1);
  assert.equal(idempotency.get("withdrawal-3").status, "succeeded");
});

test("rejects reusing a withdrawal idempotency key for another mentor", async () => {
  const { service } = build({ balance: 75 });
  await service.withdrawEarningsService("mentor-1", "withdrawal-4");
  await assert.rejects(service.withdrawEarningsService("mentor-2", "withdrawal-4"), {
    statusCode: 409,
    code: "IDEMPOTENCY_KEY_REUSED",
  });
});
