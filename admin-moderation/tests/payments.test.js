const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../app");
const createAdminPaymentsService = require("../services/payments.service");
const createAdminPaymentsRouter = require("../routes/payments.routes");

test("Admin Payments combines owner metrics and preserves transaction DTOs", async () => {
  const paymentQueries = [];
  const service = createAdminPaymentsService({
    paymentsClient: {
      getAdminPaymentSummary: async () => ({ data: { commissionRate: 20, pendingPayouts: 15 } }),
      getAdminPaymentTransactions: async (query) => {
        paymentQueries.push(query);
        return { data: { transactions: [{ id: "tx-1", userId: "user-1", amount: 10 }], pagination: { currentPage: 2 } } };
      },
    },
    workspaceClient: {
      getPaymentStats: async () => ({ data: { totalRevenue: 120, platformCommission: 20, refundedRequests: 1 } }),
      getPaymentChart: async () => ({ data: [{ label: "OCT", amount: 120 }] }),
    },
    identityClient: {
      listUsers: async () => ({ data: { users: [{ _id: "user-1" }] } }),
      getUser: async () => ({ data: { user: { name: "Alex Mentor", email: "alex@example.com" } } }),
    },
  });

  assert.deepEqual(await service.getStats("corr-1"), {
    totalRevenue: 120,
    platformCommission: 20,
    refundedRequests: 1,
    commissionRate: 20,
    pendingPayouts: 15,
  });
  assert.deepEqual(await service.getRevenueChart("corr-1"), [{ label: "OCT", amount: 120 }]);
  const transactions = await service.getTransactions({ search: "Alex", page: 2, limit: 15 }, "corr-1");
  assert.deepEqual(paymentQueries[0], { page: 2, limit: 15, type: undefined, userIds: "user-1" });
  assert.deepEqual(transactions.transactions[0].user, { name: "Alex Mentor", email: "alex@example.com" });
  assert.deepEqual(transactions.pagination, { currentPage: 2 });
});

test("Admin Payments browser routes are mounted behind administrator authentication", async () => {
  const authenticate = (req, _res, next) => { req.admin = { _id: "admin-1" }; next(); };
  const router = createAdminPaymentsRouter({
    authenticate,
    controller: {
      getStats: (_req, res) => res.json({ success: true, data: { totalRevenue: 1 } }),
      getRevenueChart: (_req, res) => res.json({ success: true, data: [] }),
      getTransactions: (_req, res) => res.json({ success: true, transactions: [], pagination: {} }),
    },
  });
  const server = http.createServer(createApp({
    health: { isReady: () => true },
    paymentsRouter: router,
  }));
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/payments/stats`);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { totalRevenue: 1 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});