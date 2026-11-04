const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/note.controller");

test("note controller forwards failures from all note operations", async () => {
  const methods = [
    ["uploadNote", "processNoteUpload"],
    ["getNotes", "getSharedNotesList"],
    ["getPrivateNotes", "getPrivateNotesList"],
    ["deleteNote", "removeNoteRecord"],
  ];
  const failure = new Error("note service failed");
  const controller = createController({
    noteService: Object.fromEntries(
      methods.map(([, serviceMethod]) => [
        serviceMethod,
        async () => { throw failure; },
      ]),
    ),
  });
  const req = {
    body: {},
    file: undefined,
    params: { connectRequestId: "request-1", id: "note-1" },
    user: { _id: "user-1" },
  };
  for (const [handler] of methods) {
    let received;
    await controller[handler](req, {}, (error) => { received = error; });
    assert.equal(received, failure, handler);
  }
});
