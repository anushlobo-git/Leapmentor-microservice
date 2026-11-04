const test = require("node:test");
const assert = require("node:assert/strict");

const createEscrowService = require("../../services/escrow.service");

const createFakes = (getCommissionRate = async () => 20) => {
  const wallets = new Map([
    [
      "mentee-1:mentee",
      { user: "mentee-1", role: "mentee", balance: 1000, escrow: 0 },
    ],
    [
      "mentor-1:mentor",
      { user: "mentor-1", role: "mentor", balance: 0, escrow: 0 },
    ],
  ]);
  const transactions = [];
  const releaseRecords = new Map();
  const invoiceEmails = [];
  const emailEvents = [];
  const context = {
    _id: "request-1",
    mentee: "mentee-1",
    mentor: "mentor-1",
    status: "accepted",
    paymentStatus: "pending",
    selectedSlots: [{ date: "2099-01-01" }],
    additionalSlots: [{
      _id: "slot-1",
      day: "Monday",
      date: "2099-01-02",
      startTime: "12:00",
      endTime: "13:00",
      paymentStatus: "pending",
    }],
  };
  const workspaceUpdates = [];
  const workspaceClient = {
    getPaymentContext: async () => context,
    createAdditionalSlot: async (_requestId, slot) => {
      const createdSlot = { _id: "slot-2", ...slot, paymentStatus: "pending" };
      context.additionalSlots.push(createdSlot);
      return { slotId: createdSlot._id, slot: createdSlot };
    },
    getInvoiceContext: async () => ({
      mentee: { name: "Mentee", email: "mentee@example.com" },
      mentor: { name: "Mentor", email: "mentor@example.com" },
      paymentStatus: "paid",
      commissionRate: 20,
      sessionRate: 100,
      sessionCount: 2,
      totalAmount: 240,
    }),
    queueInvoiceEmail: async (event) => invoiceEmails.push(event),
    queueEmailEvent: async (event) => emailEvents.push(event),
    updatePaymentState: async (_id, state) => {
      workspaceUpdates.push(state);
      if (state.additionalSlotId) {
        const slot = context.additionalSlots.find(
          (item) => item._id === state.additionalSlotId,
        );
        const { paymentStatus, paidAt, sessionRate, totalAmount } = state;
        const paymentState = { paymentStatus, paidAt, sessionRate, totalAmount };
        Object.assign(context, paymentState);
        Object.assign(slot, paymentState);
        if (state.selectedSlot && !context.selectedSlots.some(
          (existing) =>
            existing.date === state.selectedSlot.date &&
            existing.startTime === state.selectedSlot.startTime,
        )) {
          context.selectedSlots.push(state.selectedSlot);
        }
      } else {
        Object.assign(context, state);
      }
      return context;
    },
  };
  const walletRepository = {
    findByUserIdAndRole: async (userId, role) =>
      wallets.get(`${userId}:${role}`),
    save: async (wallet) => wallet,
  };
  const transactionRepository = {
    findEscrowReleaseByKey: async (key) => releaseRecords.get(key) || null,
    createMany: async (items) => {
      for (const item of items) {
        if (!item.idempotencyKey) continue;
        if (releaseRecords.has(item.idempotencyKey)) {
          const error = new Error("duplicate key");
          error.code = 11000;
          throw error;
        }
        releaseRecords.set(item.idempotencyKey, item);
      }
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
    getCommissionRate,
    generateInvoice: async () => Buffer.from("%PDF-invoice"),
    logger: { warn() {} },
  });
  return {
    service,
    wallets,
    transactions,
    context,
    workspaceClient,
    workspaceUpdates,
    invoiceEmails,
    emailEvents,
    releaseRecords,
  };
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
  assert.equal(fakes.invoiceEmails[0].reporterEmail, "mentee@example.com");
  assert.equal(
    fakes.invoiceEmails[0].invoicePdfBase64,
    Buffer.from("%PDF-invoice").toString("base64"),
  );
  assert.deepEqual(
    fakes.emailEvents.map((event) => event.eventType),
    ["payment.received.email", "payment.calendar-invite.email"],
  );
});

test("invoice email failures do not roll back a successful escrow payment", async () => {
  const fakes = createFakes();
  fakes.service = createEscrowService({
    walletRepository: {
      findByUserIdAndRole: async (userId, role) =>
        fakes.wallets.get(`${userId}:${role}`),
      save: async (wallet) => wallet,
    },
    transactionRepository: {
      createMany: async (items) => fakes.transactions.push(...items),
    },
    workspaceClient: {
      getPaymentContext: async () => fakes.context,
      updatePaymentState: async (_id, state) => {
        fakes.workspaceUpdates.push(state);
        Object.assign(fakes.context, state);
      },
      getInvoiceContext: async () => ({
        mentee: { name: "Mentee", email: "mentee@example.com" },
        mentor: { name: "Mentor", email: "mentor@example.com" },
        selectedSlots: [
          { date: "2099-01-01", startTime: "10:00", endTime: "11:00" },
        ],
        sessionRate: 100,
        sessionCount: 2,
        mentorPayout: 200,
        commissionRate: 20,
      }),
      queueInvoiceEmail: async () => {
        throw new Error("Notifications unavailable");
      },
      queueEmailEvent: async (event) => fakes.emailEvents.push(event),
    },
    runInTransaction: async (work) => work({}),
    getCommissionRate: async () => 20,
    generateInvoice: async () => Buffer.from("%PDF"),
    logger: { warn() {} },
  });
  const result = await fakes.service.pay({
    connectRequestId: "request-1",
    sessionRate: 100,
    sessionCount: 2,
    menteeId: "mentee-1",
  });
  assert.equal(result.paymentStatus, "paid");
  assert.equal(fakes.transactions[0].type, "escrow_hold");
  assert.deepEqual(
    fakes.emailEvents.map((event) => event.eventType),
    ["payment.received.email", "payment.calendar-invite.email"],
  );
});

test("releases escrow to the mentor and marks the Workspace request completed", async () => {
  const fakes = createFakes();
  await fakes.service.pay({
    connectRequestId: "request-1",
    sessionRate: 100,
    sessionCount: 2,
    menteeId: "mentee-1",
  });

  const result = await fakes.service.release({
    requestId: "request-1",
    menteeId: "mentee-1",
  });

  assert.equal(result.status, "completed");
  assert.equal(result.mentorPayout, 200);
  assert.equal(fakes.wallets.get("mentee-1:mentee").escrow, 0);
  assert.equal(fakes.wallets.get("mentor-1:mentor").balance, 200);
  assert.equal(fakes.workspaceUpdates.at(-1).status, "completed");
});

test("retries Workspace projection after escrow committed without paying twice", async () => {
  const fakes = createFakes();
  await fakes.service.pay({
    connectRequestId: "request-1",
    sessionRate: 100,
    sessionCount: 2,
    menteeId: "mentee-1",
  });
  const updatePaymentState = fakes.workspaceClient.updatePaymentState;
  let shouldFail = true;
  fakes.workspaceClient.updatePaymentState = async (...args) => {
    if (shouldFail) {
      shouldFail = false;
      throw new Error("Workspace unavailable");
    }
    return updatePaymentState(...args);
  };

  await assert.rejects(
    fakes.service.release({ requestId: "request-1", menteeId: "mentee-1" }),
    /Workspace unavailable/,
  );
  assert.equal(fakes.wallets.get("mentor-1:mentor").balance, 200);

  const retry = await fakes.service.release({
    requestId: "request-1",
    menteeId: "mentee-1",
  });
  assert.equal(retry.status, "completed");
  assert.equal(fakes.wallets.get("mentor-1:mentor").balance, 200);
  assert.equal(
    fakes.transactions.filter(
      (transaction) => transaction.type === "mentor_payout",
    ).length,
    1,
  );
  assert.equal(fakes.context.status, "completed");
});

test("refunds paid escrow for an authorized participant", async () => {
  const fakes = createFakes();
  await fakes.service.pay({
    connectRequestId: "request-1",
    sessionRate: 100,
    sessionCount: 2,
    menteeId: "mentee-1",
  });

  const result = await fakes.service.refund({
    requestId: "request-1",
    userId: "mentor-1",
  });

  assert.equal(result.paymentStatus, "refunded");
  assert.equal(result.balance, 1000);
  assert.equal(result.escrow, 0);
  assert.equal(fakes.workspaceUpdates.at(-1).status, "rejected");
});

test("returns a participant-scoped escrow status and rejects outsiders", async () => {
  const fakes = createFakes();
  await fakes.service.pay({
    connectRequestId: "request-1",
    sessionRate: 100,
    sessionCount: 2,
    menteeId: "mentee-1",
  });

  const status = await fakes.service.getStatus({
    requestId: "request-1",
    userId: "mentee-1",
  });
  assert.deepEqual(status.wallet, { balance: 760, escrow: 240 });
  await assert.rejects(
    fakes.service.getStatus({ requestId: "request-1", userId: "outsider" }),
    {
      statusCode: 403,
      code: "NOT_REQUEST_PARTICIPANT",
    },
  );
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
  assert.equal(fakes.context.selectedSlots.at(-1).date, "2099-01-02");
  assert.equal(fakes.workspaceUpdates.at(-1).selectedSlot.status, "booked");
  assert.equal(fakes.wallets.get("mentee-1:mentee").escrow, 120);
});

test("uses the current platform commission instead of a stored historical rate", async () => {
  const fakes = createFakes(async () => 10);
  fakes.context.status = "ongoing";
  fakes.context.paymentStatus = "paid";
  fakes.context.commissionRate = 20;

  const status = await fakes.service.getStatus({
    requestId: "request-1",
    userId: "mentee-1",
  });

  test("creates the additional slot only when payment is submitted and books it after charge", async () => {
    const fakes = createFakes();
    fakes.context.status = "ongoing";
    fakes.context.paymentStatus = "paid";

    const payment = await fakes.service.payAdditional({
      connectRequestId: "request-1",
      sessionRate: 100,
      slot: {
        day: "Monday",
        date: "2099-01-03",
        startTime: "14:00",
        endTime: "15:00",
      },
      menteeId: "mentee-1",
    });

    assert.equal(payment.slotId, "slot-2");
    assert.equal(payment.totalAmount, 120);
    assert.equal(
      fakes.context.selectedSlots.some((item) => item.date === "2099-01-03"),
      true,
    );
    assert.equal(fakes.context.additionalSlots.at(-1).paymentStatus, "paid");
  });
  assert.equal(status.commissionRate, 10);

  const payment = await fakes.service.payAdditional({
    connectRequestId: "request-1",
    sessionRate: 100,
    slotId: "slot-1",
    menteeId: "mentee-1",
  });
  assert.equal(payment.platformFee, 10);
  assert.equal(payment.totalAmount, 110);
  assert.equal(payment.commissionRate, 10);
});
