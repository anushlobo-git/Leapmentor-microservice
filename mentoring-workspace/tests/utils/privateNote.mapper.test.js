const test = require("node:test");
const assert = require("node:assert/strict");

const { toPrivateNoteDTO } = require("../../utils/privateNote.mapper");

test("returns null for missing notes and supplies safe defaults", () => {
  assert.equal(toPrivateNoteDTO(null), null);
  assert.deepEqual(toPrivateNoteDTO({}), {
    _id: undefined,
    connectRequest: undefined,
    author: undefined,
    title: "Untitled Note",
    content: "",
    createdAt: undefined,
    updatedAt: undefined,
  });
});

test("serializes populated and lean private note references", () => {
  const populated = toPrivateNoteDTO({
    _id: { toString: () => "note-1" },
    connectRequest: { _id: { toString: () => "request-1" } },
    author: { _id: { toString: () => "user-1" } },
    title: "Private",
    content: "Text",
  });
  assert.equal(populated._id, "note-1");
  assert.equal(populated.connectRequest, "request-1");
  assert.equal(populated.author, "user-1");

  const lean = toPrivateNoteDTO({
    _id: "note-2",
    connectRequest: "request-2",
    author: "user-2",
    title: "Title",
    content: "Body",
  });
  assert.equal(lean.connectRequest, "request-2");
  assert.equal(lean.author, "user-2");
  assert.equal(lean.title, "Title");
});
