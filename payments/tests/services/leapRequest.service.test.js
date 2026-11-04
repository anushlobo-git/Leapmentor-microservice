const test = require("node:test");
const assert = require("node:assert/strict");

const createLeapRequestService = require("../../services/leapRequest.service");

const build = ({ balance = 20, request = null } = {}) => {
  const state = { balance, request, transactions: [] };
  const service = createLeapRequestService({
    leapRequestRepository: {
      findLatestByMenteeAndStatus: async () => state.request,
      create: async (data) => {
        state.request = { _id: "request-1", status: "pending", ...data };
        return state.request;
      },
      findAll: async () => (state.request ? [state.request] : []),
      countByStatus: async () => (state.request?.status === "pending" ? 1 : 0),
      findById: async () => state.request,
      save: async (saved) => saved,
    },
    walletRepository: {
      findWalletByUserAndRole: async (_id, role) =>
        role === "mentee" ? { balance: state.balance } : null,
      findByUserIdAndRole: async (_id, role) =>
        role === "mentee" ? { balance: state.balance } : null,
      save: async (wallet) => {
        state.balance = wallet.balance;
      },
    },
    transactionRepository: {
      createTransaction: async (entry) => state.transactions.push(entry),
    },
    runInTransaction: (work) => work(null),
  });
  return { service, state };
};

test("creates a pending allocation request with the current mentee balance", async () => {
  const { service, state } = build({ balance: 42 });
  const request = await service.createLeapRequest("mentee-1");
  assert.equal(request.currentBalance, 42);
  assert.equal(request.status, "pending");
  assert.equal(state.request.mentee, "mentee-1");
});

test("rejects duplicate pending requests and balances at the limit", async () => {
  const pending = { _id: "request-1", status: "pending", mentee: "mentee-1" };
  await assert.rejects(
    build({ request: pending }).service.createLeapRequest("mentee-1"),
    {
      statusCode: 409,
      code: "LEAP_REQUEST_EXISTS",
    },
  );
  await assert.rejects(
    build({ balance: 500 }).service.createLeapRequest("mentee-1"),
    {
      statusCode: 400,
      code: "LEAP_BALANCE_TOO_HIGH",
    },
  );
});

test("approves once, credits the mentee wallet, and writes a ledger entry", async () => {
  const request = { _id: "request-1", status: "pending", mentee: "mentee-1" };
  const { service, state } = build({ balance: 10, request });
  const result = await service.approveLeapRequest("request-1", "admin-1");
  assert.equal(result.newBalance, 510);
  assert.equal(result.request.status, "approved");
  assert.equal(state.transactions[0].amount, 500);
  assert.equal(state.transactions[0].balanceAfter, 510);
});

test("rejects closed requests without granting wallet points", async () => {
  const request = { _id: "request-1", status: "approved", mentee: "mentee-1" };
  const { service, state } = build({ balance: 10, request });
  await assert.rejects(service.approveLeapRequest("request-1", "admin-1"), {
    statusCode: 409,
    code: "LEAP_REQUEST_CLOSED",
  });
  assert.equal(state.balance, 10);
  assert.equal(state.transactions.length, 0);
});
