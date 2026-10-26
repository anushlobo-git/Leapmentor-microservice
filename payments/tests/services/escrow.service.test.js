const test = require("node:test");
const assert = require("node:assert/strict");

const createEscrowService = require("../../services/escrow.service");

const createFakes = () => {
  const wallets = new Map([
    ["mentee-1:mentee", { user: "mentee-1", role: "mentee", balance: 1000, escrow: 0 }],
    ["mentor-1:mentor", { user: "mentor-1", role: "mentor", balance: 0, escrow: 0 }],
  ]);
  const transactions = [];
  const context = {
    _id: "request-1",
    mentee: "mentee-1",
    mentor: "mentor-1",
    status: "accepted",
    paymentStatus: "pending",
    selectedSlots: [{ date: "2099-01-01" }],
    additionalSlots: [{ _id: "slot-1", paymentStatus: "pending" }],
  };
  const workspaceUpdates = [];
  const workspaceClient = {
    getPaymentContext: async () => context,
    updatePaymentState: async (_id, state) => {
      workspaceUpdates.push(state);
      Object.assign(context, state);
      if (state.additionalSlotId) {
        const slot = context.additionalSlots.find((item) => item._id === state.additionalSlotId);
        Object.assign(slot, state);
      }
      return context;
    },
  };
  const walletRepository = {
    findByUserIdAndRole: async (userId, role) => wallets.get(`${userId}:${role}`),
    save: async (wallet) => wallet,
  };
  const transactionRepository = {
    createMany: async (items) => {
      transactions.push(...items);
      return items;
    },
  };
  const service = createEscrowService({
    walletRepository,
    transactionRepository,
    workspaceClient,
    runInTransaction: async (work) => work({}),
    commissionRate: 20,
  });
  return { service, wallets, transactions, context, workspaceUpdates };
};

test("holds mentee funds, records a ledger transaction, and updates Workspace state", async () => {
  const fakes = createFakes();

  const result = await fakes.service.pay({
    connectRequestId: "request-1",
    sessionRate: 100,
    sessionCount: 2,
    menteeId: "mentee-1",
    correlationId: "corr-1",
  });

  assert.deepEqual(result, {
    mentorAmount: 200,
    platformFee: 40,
    totalAmount: 240,
    commissionRate: 20,
    balance: 760,
    escrow: 240,
    paymentStatus: "paid",
    status: "ongoing",
  });
  assert.equal(fakes.transactions[0].type, "escrow_hold");
  assert.equal(fakes.workspaceUpdates[0].paymentStatus, "paid");
});

test("releases escrow to the mentor and marks the Workspace request completed", async () => {
  const fakes = createFakes();
  await fakes.service.pay({ connectRequestId: "request-1", sessionRate: 100, sessionCount: 2, menteeId: "mentee-1" });

  const result = await fakes.service.release({ requestId: "request-1", menteeId: "mentee-1" });

  assert.equal(result.status, "completed");
  assert.equal(result.mentorPayout, 200);
  assert.equal(fakes.wallets.get("mentee-1:mentee").escrow, 0);
  assert.equal(fakes.wallets.get("mentor-1:mentor").balance, 200);
  assert.equal(fakes.workspaceUpdates.at(-1).status, "completed");
});

test("refunds paid escrow for an authorized participant", async () => {
  const fakes = createFakes();
  await fakes.service.pay({ connectRequestId: "request-1", sessionRate: 100, sessionCount: 2, menteeId: "mentee-1" });

  const result = await fakes.service.refund({ requestId: "request-1", userId: "mentor-1" });

  assert.equal(result.paymentStatus, "refunded");
  assert.equal(result.balance, 1000);
  assert.equal(result.escrow, 0);
  assert.equal(fakes.workspaceUpdates.at(-1).status, "rejected");
});

test("returns a participant-scoped escrow status and rejects outsiders", async () => {
  const fakes = createFakes();
  await fakes.service.pay({ connectRequestId: "request-1", sessionRate: 100, sessionCount: 2, menteeId: "mentee-1" });

  const status = await fakes.service.getStatus({ requestId: "request-1", userId: "mentee-1" });
  assert.deepEqual(status.wallet, { balance: 760, escrow: 240 });
  await assert.rejects(fakes.service.getStatus({ requestId: "request-1", userId: "outsider" }), {
    statusCode: 403,
    code: "NOT_REQUEST_PARTICIPANT",
  });
});

test("charges and marks an additional Workspace slot", async () => {
  const fakes = createFakes();
  fakes.context.status = "ongoing";
  fakes.context.paymentStatus = "paid";

  const result = await fakes.service.payAdditional({
    connectRequestId: "request-1",
    sessionRate: 100,
    slotId: "slot-1",
    menteeId: "mentee-1",
  });

  assert.equal(result.totalAmount, 120);
  assert.equal(fakes.context.additionalSlots[0].paymentStatus, "paid");
  assert.equal(fakes.wallets.get("mentee-1:mentee").escrow, 120);
});
