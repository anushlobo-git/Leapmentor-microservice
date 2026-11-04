const test = require("node:test");
const assert = require("node:assert/strict");

const createTransactionRepository = require("../../repositories/transaction.repository");

test("creates multiple ledger transactions in order when using a session", async () => {
  const calls = [];
  const Transaction = {
    create: async (...args) => {
      calls.push(args);
      return args[0];
    },
  };
  const repository = createTransactionRepository(Transaction);
  const rows = [{ type: "escrow_release" }, { type: "mentor_payout" }];
  const session = { id: "session-1" };

  await repository.createMany(rows, session);

  assert.deepEqual(calls, [[rows, { session, ordered: true }]]);
});
