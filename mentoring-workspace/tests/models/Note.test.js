const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Note = require("../../models/Note");

const objectId = () => new mongoose.Types.ObjectId();

const validNote = (overrides = {}) => ({
  connectRequest: objectId(),
  uploadedBy: objectId(),
  uploaderRole: "mentee",
  fileUrl: "https://cdn.example/file.pdf",
  publicId: "leapmentor/notes/abc/file",
  ...overrides,
});

test("a note with the required fields is valid and gets the documented defaults", () => {
  const note = new Note(validNote());

  assert.equal(note.validateSync(), undefined);
  assert.equal(note.isPrivate, false);
  assert.equal(note.fileType, "other");
  assert.equal(note.title, "");
  assert.equal(note.fileName, "");
  assert.equal(note.fileSize, 0);
});

test("connectRequest, uploadedBy, uploaderRole, fileUrl and publicId are required", () => {
  const error = new Note({}).validateSync();

  for (const field of [
    "connectRequest",
    "uploadedBy",
    "uploaderRole",
    "fileUrl",
    "publicId",
  ]) {
    assert.ok(error.errors[field], `${field} should be required`);
  }
});

test("uploaderRole and fileType only accept the documented values", () => {
  const badRole = new Note(validNote({ uploaderRole: "admin" })).validateSync();
  assert.ok(badRole.errors.uploaderRole);

  const badType = new Note(validNote({ fileType: "video" })).validateSync();
  assert.ok(badType.errors.fileType);

  for (const fileType of [
    "pdf",
    "image",
    "doc",
    "ppt",
    "excel",
    "txt",
    "other",
  ]) {
    assert.equal(new Note(validNote({ fileType })).validateSync(), undefined);
  }
  for (const uploaderRole of ["mentor", "mentee"]) {
    assert.equal(
      new Note(validNote({ uploaderRole })).validateSync(),
      undefined,
    );
  }
});

test("title is trimmed and limited to 200 characters", () => {
  assert.equal(new Note(validNote({ title: "  Notes  " })).title, "Notes");
  assert.equal(
    new Note(validNote({ title: "x".repeat(200) })).validateSync(),
    undefined,
  );
  assert.ok(
    new Note(validNote({ title: "x".repeat(201) })).validateSync().errors.title,
  );
});

test("declares the three monolith indexes", () => {
  const indexes = Note.schema.indexes().map(([fields]) => fields);

  assert.deepEqual(indexes, [
    { connectRequest: 1, createdAt: -1 },
    { uploadedBy: 1 },
    { connectRequest: 1, uploadedBy: 1, isPrivate: 1 },
  ]);
});

test("uploadedBy has no ref because Identity owns users", () => {
  assert.equal(Note.schema.path("uploadedBy").options.ref, undefined);
  assert.equal(
    Note.schema.path("connectRequest").options.ref,
    "ConnectRequest",
  );
});
