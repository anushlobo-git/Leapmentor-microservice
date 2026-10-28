const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/internalAdminPayments.controller");

const response = () => ({
  statusCode: null,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("returns Payments-owned commission and aggregate escrow balances", async () => {
  const controller = createController({
    platformSettingsService: { getCommissionRate: async () => 18 },
    walletRepository: { sumEscrowBalances: async () => 75 },
    transactionRepository: {},
  });
  const res = response();
  await controller.getSummary({}, res, assert.fail);
  assert.equal(res.body.data.commissionRate, 18);
  assert.equal(res.body.data.pendingPayouts, 75);
});

test("applies admin transaction page, type, and identity filters before mapping rows", async () => {
  const calls = [];
  const controller = createController({
    platformSettingsService: {},
    walletRepository: {},
    transactionRepository: {
      countTransactions: async (filter) => { calls.push(["count", filter]); return 1; },
      findTransactions: async (filter, page) => {
        calls.push(["find", filter, page]);
        return [{ _id: "507f1f77bcf86cd799439011", user: "user-1", type: "escrow_release", amount: 25, createdAt: "2026-10-28T00:00:00Z" }];
      },
    },
  });
  const res = response();
  await controller.getTransactions({ query: { page: "2", limit: "10", type: "escrow_release", userIds: "user-1,user-2" } }, res, assert.fail);
  assert.deepEqual(calls[0], ["count", { user: { $in: ["user-1", "user-2"] }, type: "escrow_release" }]);
  assert.deepEqual(calls[1][2], { skip: 10, limit: 10 });
  assert.equal(res.body.data.transactions[0].userId, "user-1");
  assert.equal(res.body.data.transactions[0].status, "completed");
  assert.equal(res.body.data.pagination.currentPage, 2);
});