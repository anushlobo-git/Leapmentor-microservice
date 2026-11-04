const test = require("node:test");
const assert = require("node:assert/strict");

const createFeedbackRepository = require("../../repositories/feedback.repository");

const query = (value) => {
  const promise = Promise.resolve(value);
  promise.calls = [];
  promise.sort = (arg) => {
    promise.calls.push(["sort", arg]);
    return promise;
  };
  promise.lean = () => {
    promise.calls.push(["lean"]);
    return promise;
  };
  return promise;
};

test("create passes data to the model", async () => {
  const received = [];
  const repository = createFeedbackRepository({
    create: async (data) => {
      received.push(data);
      return { _id: "f1", ...data };
    },
  });
  assert.equal((await repository.create({ rating: 5 }))._id, "f1");
  assert.deepEqual(received, [{ rating: 5 }]);
});

test("findOne filters by the given query and returns a lean object", async () => {
  const read = query({ _id: "f1" });
  const repository = createFeedbackRepository({
    findOne: (filter) => {
      assert.deepEqual(filter, {
        connectRequest: "r1",
        from: "u1",
        slotIndex: 2,
      });
      return read;
    },
  });
  assert.deepEqual(
    await repository.findOne({
      connectRequest: "r1",
      from: "u1",
      slotIndex: 2,
    }),
    { _id: "f1" },
  );
  assert.deepEqual(read.calls, [["lean"]]);
});

test("findAllByConnectRequest is oldest first and lean", async () => {
  const read = query([{ _id: "f1" }]);
  const repository = createFeedbackRepository({
    find: (filter) => {
      assert.deepEqual(filter, { connectRequest: "r1" });
      return read;
    },
  });
  assert.deepEqual(await repository.findAllByConnectRequest("r1"), [
    { _id: "f1" },
  ]);
  assert.deepEqual(read.calls, [["sort", { createdAt: 1 }], ["lean"]]);
});

test("findAllByTargetUser filters on the receiver and is lean", async () => {
  const read = query([{ rating: 4 }]);
  const repository = createFeedbackRepository({
    find: (filter) => {
      assert.deepEqual(filter, { to: "m1" });
      return read;
    },
  });
  assert.deepEqual(await repository.findAllByTargetUser("m1"), [{ rating: 4 }]);
  assert.deepEqual(read.calls, [["lean"]]);
});
