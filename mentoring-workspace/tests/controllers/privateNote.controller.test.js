const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/privateNote.controller");

test("private note controller forwards service failures from every operation", async () => {
  const methods = [
    ["createNote", "createPrivateNote"],
    ["getNotes", "getPrivateNotesList"],
    ["updateNote", "updatePrivateNote"],
    ["deleteNote", "removePrivateNote"],
  ];
  const failure = new Error("private note service failed");
  const controller = createController({
    privateNoteService: Object.fromEntries(
      methods.map(([, serviceMethod]) => [
        serviceMethod,
        async () => { throw failure; },
      ]),
    ),
  });
  const req = {
    body: {},
    params: { connectRequestId: "request-1", id: "note-1" },
    user: { _id: "user-1" },
  };
  for (const [handler] of methods) {
    let received;
    await controller[handler](req, {}, (error) => { received = error; });
    assert.equal(received, failure, handler);
  }
});
