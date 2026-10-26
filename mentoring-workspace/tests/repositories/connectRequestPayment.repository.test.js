const test = require("node:test");
const assert = require("node:assert/strict");

const createConnectRequestPaymentRepository = require("../../repositories/connectRequestPayment.repository");

const query = (value) => {
  const promise = Promise.resolve(value);
  promise.select = (...args) => {
    promise.selected = args;
    return promise;
  };
  promise.lean = () => promise;
  return promise;
};

test("reads the payment context without exposing unrelated Workspace fields", async () => {
  const read = query({ _id: "request-1" });
  const calls = [];
  const repository = createConnectRequestPaymentRepository({
    findById: (id) => {
      calls.push(["find", id]);
      return read;
    },
  });

  assert.deepEqual(await repository.findPaymentContext("request-1"), { _id: "request-1" });
  assert.deepEqual(calls, [["find", "request-1"]]);
  assert.match(read.selected[0], /paymentStatus/);
  assert.doesNotMatch(read.selected[0], /privateMessage/);
});

test("updates only payment-owned fields and supports additional-slot state", async () => {
  const calls = [];
  const repository = createConnectRequestPaymentRepository({
    findOneAndUpdate: (...args) => {
      calls.push(["slot", ...args]);
      return query({ _id: "request-1" });
    },
    findByIdAndUpdate: (...args) => {
      calls.push(["request", ...args]);
      return query({ _id: "request-1" });
    },
  });

  await repository.updatePaymentState("request-1", {
    paymentStatus: "paid",
    status: "ongoing",
    privateMessage: "must-not-update",
    additionalSlotId: "slot-1",
    sessionRate: 100,
  });

  assert.deepEqual(calls[0], [
    "slot",
    { _id: "request-1", "additionalSlots._id": "slot-1" },
    { $set: { "additionalSlots.$.paymentStatus": "paid", "additionalSlots.$.sessionRate": 100 } },
    { new: true, runValidators: true },
  ]);
});
