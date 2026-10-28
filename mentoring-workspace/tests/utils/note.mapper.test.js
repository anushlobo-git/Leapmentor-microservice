const test = require("node:test");
const assert = require("node:assert/strict");

const { toNoteDTO } = require("../../utils/note.mapper");

const objectId = (value) => ({ toString: () => value });

const storedNote = () => ({
  _id: objectId("note-1"),
  connectRequest: objectId("request-1"),
  uploadedBy: objectId("user-1"),
  uploaderRole: "mentor",
  title: "Week 1",
  fileUrl: "https://cdn.example/a.pdf",
  publicId: "leapmentor/notes/request-1/a",
  fileType: "pdf",
  fileName: "a.pdf",
  fileSize: 2048,
  isPrivate: false,
  createdAt: "2026-10-28T00:00:00.000Z",
  updatedAt: "2026-10-28T00:00:00.000Z",
  __v: 0,
});

test("returns null for a missing note", () => {
  assert.equal(toNoteDTO(null), null);
  assert.equal(toNoteDTO(undefined), null);
});

test("serialises ObjectIds and exposes only note fields", () => {
  const dto = toNoteDTO({ ...storedNote(), secret: "hidden" });

  assert.equal(dto._id, "note-1");
  assert.equal(dto.connectRequest, "request-1");
  assert.equal(dto.title, "Week 1");
  assert.equal(dto.fileSize, 2048);
  assert.equal("secret" in dto, false);
  assert.equal("__v" in dto, false);
});

test("uploadedBy carries both _id and id when Identity supplied a summary", () => {
  const dto = toNoteDTO(storedNote(), {
    _id: "user-1",
    name: "Jane Doe",
    email: "jane@example.com",
    roles: ["mentor"],
    password: "must-not-leak",
  });

  assert.deepEqual(dto.uploadedBy, {
    _id: "user-1",
    id: "user-1",
    name: "Jane Doe",
    email: "jane@example.com",
  });
});

test("uploadedBy falls back to the plain ID string without a summary", () => {
  assert.equal(toNoteDTO(storedNote()).uploadedBy, "user-1");
  assert.equal(toNoteDTO(storedNote(), null).uploadedBy, "user-1");
});

test("tolerates an already-populated uploadedBy object", () => {
  const dto = toNoteDTO({
    ...storedNote(),
    uploadedBy: { _id: objectId("user-9") },
  });

  assert.equal(dto.uploadedBy, "user-9");
});

test("applies the monolith defaults for missing optional fields", () => {
  const dto = toNoteDTO({
    _id: "n",
    connectRequest: "r",
    uploadedBy: "u",
  });

  assert.equal(dto.uploaderRole, "");
  assert.equal(dto.title, "");
  assert.equal(dto.fileUrl, "");
  assert.equal(dto.publicId, "");
  assert.equal(dto.fileType, "other");
  assert.equal(dto.fileName, "");
  assert.equal(dto.fileSize, 0);
  assert.equal(dto.isPrivate, false);
});
