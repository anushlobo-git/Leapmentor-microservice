const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createAdminPaymentsService = require("../../services/payments.service");
const createAdminPaymentsRouter = require("../../routes/payments.routes");
const createAdminPaymentsController = require("../../controllers/payments.controller");

test("Admin Payments transactions use the standard API envelope", async () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const controller = createAdminPaymentsController({
    paymentsService: {
      getTransactions: async () => ({
        transactions: [{ id: "tx-1" }],
        pagination: { totalCount: 1 },
      }),
    },
  });

  await controller.getTransactions({ query: {}, correlationId: "corr-1" }, response, () => {});

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: {
      transactions: [{ id: "tx-1" }],
      pagination: { totalCount: 1 },
    },
    message: "Transactions retrieved",
  });
});

test("Admin Payments combines owner metrics and preserves transaction DTOs", async () => {
  const paymentQueries = [];
  const service = createAdminPaymentsService({
    paymentsClient: {
      getAdminPaymentSummary: async () => ({
        data: { commissionRate: 20, pendingPayouts: 15 },
      }),
      getAdminPaymentTransactions: async (query) => {
        paymentQueries.push(query);
        return {
          data: {
            transactions: [{ id: "tx-1", userId: "user-1", amount: 10 }],
            pagination: { totalCount: 1, currentPage: 2 },
          },
        };
      },
    },
    workspaceClient: {
      getPaymentStats: async () => ({
        data: {
          totalRevenue: 120,
          platformCommission: 20,
          refundedRequests: 1,
        },
      }),
      getPaymentChart: async () => ({ data: [{ label: "OCT", amount: 120 }] }),
    },
    identityClient: {
      listUsers: async () => ({ data: { users: [{ _id: "user-1" }] } }),
      getUser: async () => ({
        data: { user: { name: "Alex Mentor", email: "alex@example.com" } },
      }),
    },
  });

  assert.deepEqual(await service.getStats("corr-1"), {
    totalRevenue: 120,
    platformCommission: 20,
    refundedRequests: 1,
    commissionRate: 20,
    pendingPayouts: 15,
  });
  assert.deepEqual(await service.getRevenueChart("corr-1"), [
    { label: "OCT", amount: 120 },
  ]);
  const transactions = await service.getTransactions(
    { search: "Alex", page: 2, limit: 15 },
    "corr-1",
  );
  assert.deepEqual(paymentQueries[0], {
    page: 2,
    limit: 15,
    type: undefined,
    userIds: "user-1",
  });
  assert.deepEqual(transactions.transactions[0].user, {
    name: "Alex Mentor",
    email: "alex@example.com",
  });
  assert.deepEqual(transactions.pagination, {
    totalCount: 1,
    currentPage: 2,
    totalPages: 1,
    hasMore: false,
  });
});

test("Admin Payments returns a complete empty pagination contract", async () => {
  const service = createAdminPaymentsService({
    paymentsClient: {
      getAdminPaymentSummary: async () => ({ data: {} }),
      getAdminPaymentTransactions: async () => ({ data: {} }),
    },
    workspaceClient: {
      getPaymentStats: async () => ({ data: {} }),
      getPaymentChart: async () => ({ data: [] }),
    },
    identityClient: {
      listUsers: async () => ({ data: { users: [] } }),
      getUser: async () => ({ data: {} }),
    },
  });

  assert.deepEqual(await service.getTransactions(), {
    transactions: [],
    pagination: {
      totalCount: 0,
      currentPage: 1,
      totalPages: 0,
      hasMore: false,
    },
  });
});

test("Admin Payments avoids querying transactions when a user search has no matches", async () => {
  let paymentQueryCalled = false;
  const service = createAdminPaymentsService({
    paymentsClient: {
      getAdminPaymentTransactions: async () => {
        paymentQueryCalled = true;
        return { data: {} };
      },
    },
    workspaceClient: {},
    identityClient: {
      listUsers: async (query, correlationId) => {
        assert.deepEqual(query, { search: "Unknown", page: 1, limit: 100 });
        assert.equal(correlationId, "corr-empty-search");
        return { data: { users: [] } };
      },
    },
  });

  assert.deepEqual(
    await service.getTransactions({ search: " Unknown " }, "corr-empty-search"),
    {
      transactions: [],
      pagination: {
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        hasMore: false,
      },
    },
  );
  assert.equal(paymentQueryCalled, false);
});

test("Admin Payments falls back for missing users and normalizes invalid pagination values", async () => {
  const service = createAdminPaymentsService({
    paymentsClient: {
      getAdminPaymentTransactions: async () => ({
        data: {
          transactions: [
            { id: "tx-missing-user", userId: "user-1" },
            { id: "tx-unavailable-user", userId: "user-2" },
          ],
          pagination: {
            totalCount: -2,
            currentPage: 0,
            totalPages: "not-a-number",
            hasMore: true,
          },
        },
      }),
    },
    workspaceClient: {},
    identityClient: {
      getUser: async (userId) => {
        if (userId === "user-2") throw new Error("Identity unavailable");
        return { data: {} };
      },
    },
  });

  const result = await service.getTransactions({ page: "3", limit: "2" });
  assert.deepEqual(result.transactions, [
    { id: "tx-missing-user", userId: "user-1", user: { name: "-", email: "-" } },
    { id: "tx-unavailable-user", userId: "user-2", user: { name: "-", email: "-" } },
  ]);
  assert.deepEqual(result.pagination, {
    totalCount: 0,
    currentPage: 1,
    totalPages: 0,
    hasMore: true,
  });
});

test("Admin Payments derives total pages and hasMore when Payments omits pagination fields", async () => {
  const service = createAdminPaymentsService({
    paymentsClient: {
      getAdminPaymentTransactions: async () => ({
        data: {
          transactions: [],
          pagination: { totalCount: "5", currentPage: "2" },
        },
      }),
    },
    workspaceClient: {},
    identityClient: {},
  });

  assert.deepEqual((await service.getTransactions({ page: "2", limit: "2" })).pagination, {
    totalCount: 5,
    currentPage: 2,
    totalPages: 3,
    hasMore: true,
  });
});

test("Admin Payments browser routes are mounted behind administrator authentication", async () => {
  const authenticate = (req, _res, next) => {
    req.admin = { _id: "admin-1" };
    next();
  };
  const router = createAdminPaymentsRouter({
    authenticate,
    controller: {
      getStats: (_req, res) =>
        res.json({ success: true, data: { totalRevenue: 1 } }),
      getRevenueChart: (_req, res) => res.json({ success: true, data: [] }),
      getTransactions: (_req, res) =>
        res.json({ success: true, transactions: [], pagination: {} }),
    },
  });
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      paymentsRouter: router,
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/admin/payments/stats`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { totalRevenue: 1 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
