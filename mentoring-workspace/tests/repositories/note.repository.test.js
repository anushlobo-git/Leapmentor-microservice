const test = require("node:test");
const assert = require("node:assert/strict");

const createNoteRepository = require("../../repositories/note.repository");

// Chainable stand-in for a Mongoose query that records what was asked.
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

test("create passes the data straight to the model", async () => {
  const received = [];
  const repository = createNoteRepository({
    create: async (data) => {
      received.push(data);
      return { _id: "note-1", ...data };
    },
  });

  const created = await repository.create({ title: "A" });

  assert.deepEqual(received, [{ title: "A" }]);
  assert.equal(created._id, "note-1");
});

test("findById returns a lean object", async () => {
  const read = query({ _id: "note-1" });
  const repository = createNoteRepository({
    findById: (id) => {
      assert.equal(id, "note-1");
      return read;
    },
  });

  assert.deepEqual(await repository.findById("note-1"), { _id: "note-1" });
  assert.deepEqual(read.calls, [["lean"]]);
});

test("findSharedByConnectRequest excludes private notes, newest first, lean", async () => {
  const read = query([{ _id: "n1" }]);
  let filter;
  const repository = createNoteRepository({
    find: (arg) => {
      filter = arg;
      return read;
    },
  });

  assert.deepEqual(await repository.findSharedByConnectRequest("request-1"), [
    { _id: "n1" },
  ]);
  assert.deepEqual(filter, {
    connectRequest: "request-1",
    isPrivate: { $ne: true },
  });
  assert.deepEqual(read.calls, [["sort", { createdAt: -1 }], ["lean"]]);
});

test("findPrivateByConnectRequestAndUser is scoped to the uploader", async () => {
  const read = query([]);
  let filter;
  const repository = createNoteRepository({
    find: (arg) => {
      filter = arg;
      return read;
    },
  });

  await repository.findPrivateByConnectRequestAndUser("request-1", "user-1");

  assert.deepEqual(filter, {
    connectRequest: "request-1",
    uploadedBy: "user-1",
    isPrivate: true,
  });
  assert.deepEqual(read.calls, [["sort", { createdAt: -1 }], ["lean"]]);
});

test("deleteById removes the document by ID", async () => {
  const removed = [];
  const repository = createNoteRepository({
    findByIdAndDelete: async (id) => {
      removed.push(id);
      return { _id: id };
    },
  });

  assert.deepEqual(await repository.deleteById("note-1"), { _id: "note-1" });
  assert.deepEqual(removed, ["note-1"]);
});
