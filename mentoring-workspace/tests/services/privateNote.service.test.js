const test = require("node:test");
const assert = require("node:assert/strict");

const createPrivateNoteService = require("../../services/privateNote.service");

const REQUEST_ID = "507f1f77bcf86cd799439011";
const NOTE_ID = "507f1f77bcf86cd799439021";

const createHarness = (overrides = {}) => {
  const state = {
    request: {
      _id: REQUEST_ID,
      mentor: "mentor-1",
      mentee: "mentee-1",
      status: "ongoing",
    },
    note: null,
    notes: [],
    created: null,
    saved: [],
    deletedId: null,
    listArgs: null,
    ...overrides.state,
  };

  const connectRequestRepository = { findById: async () => state.request };
  const privateNoteRepository = {
    create: async (data) => {
      state.created = data;
      return { _id: NOTE_ID, ...data };
    },
    findBySessionAndAuthor: async (...args) => {
      state.listArgs = args;
      return state.notes;
    },
    findById: async () => state.note,
    save: async (note) => {
      state.saved.push(note);
      return note;
    },
    deleteById: async (id) => {
      state.deletedId = id;
    },
    ...overrides.repository,
  };

  return {
    state,
    service: createPrivateNoteService({
      privateNoteRepository,
      connectRequestRepository,
    }),
  };
};

const ownedNote = () => ({
  _id: NOTE_ID,
  connectRequest: REQUEST_ID,
  author: "mentee-1",
  title: "Old",
  content: "old content",
});

test("createPrivateNote stores a trimmed note authored by the participant", async () => {
  const { service, state } = createHarness();
  const note = await service.createPrivateNote("mentee-1", {
    connectRequestId: REQUEST_ID,
    title: "  Plan  ",
    content: "Ask about APIs",
  });

  assert.equal(note.title, "Plan");
  assert.equal(note.content, "Ask about APIs");
  assert.equal(note.author, "mentee-1");
  assert.equal(state.created.connectRequest, REQUEST_ID);
  assert.equal(state.created.author, "mentee-1");
});

test("createPrivateNote falls back to the default title and empty content", async () => {
  const { service } = createHarness();
  const note = await service.createPrivateNote("mentor-1", {
    connectRequestId: REQUEST_ID,
    title: "   ",
  });
  assert.equal(note.title, "Untitled Note");
  assert.equal(note.content, "");
});

test("createPrivateNote works for completed sessions", async () => {
  const { service } = createHarness({
    state: {
      request: { mentor: "mentor-1", mentee: "mentee-1", status: "completed" },
    },
  });
  const note = await service.createPrivateNote("mentor-1", {
    connectRequestId: REQUEST_ID,
  });
  assert.equal(note.title, "Untitled Note");
});

test("createPrivateNote rejects missing ids, unknown sessions, inactive sessions and outsiders", async () => {
  const { service } = createHarness();
  await assert.rejects(service.createPrivateNote("mentee-1", {}), {
    statusCode: 400,
    code: "CONNECT_REQUEST_REQUIRED",
  });
  await assert.rejects(
    service.createPrivateNote("outsider", { connectRequestId: REQUEST_ID }),
    { statusCode: 403, code: "NOT_SESSION_PARTICIPANT" },
  );

  const missing = createHarness({ state: { request: null } });
  await assert.rejects(
    missing.service.createPrivateNote("mentee-1", {
      connectRequestId: REQUEST_ID,
    }),
    { statusCode: 404, code: "SESSION_NOT_FOUND" },
  );

  const pending = createHarness({
    state: {
      request: { mentor: "mentor-1", mentee: "mentee-1", status: "pending" },
    },
  });
  await assert.rejects(
    pending.service.createPrivateNote("mentee-1", {
      connectRequestId: REQUEST_ID,
    }),
    { statusCode: 400, code: "SESSION_INACTIVE" },
  );
  assert.equal(pending.state.created, null);
});

test("getPrivateNotesList returns only the caller's notes as DTOs", async () => {
  const { service, state } = createHarness({ state: { notes: [ownedNote()] } });
  const notes = await service.getPrivateNotesList(REQUEST_ID, "mentee-1");
  assert.deepEqual(state.listArgs, [REQUEST_ID, "mentee-1"]);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, "Old");
  assert.equal("__v" in notes[0], false);
});

test("getPrivateNotesList rejects outsiders without querying notes", async () => {
  const { service, state } = createHarness();
  await assert.rejects(service.getPrivateNotesList(REQUEST_ID, "outsider"), {
    statusCode: 403,
  });
  assert.equal(state.listArgs, null);
});

test("updatePrivateNote lets the author change title and content", async () => {
  const { service, state } = createHarness({ state: { note: ownedNote() } });
  const updated = await service.updatePrivateNote(NOTE_ID, "mentee-1", {
    title: " New ",
    content: "fresh",
  });
  assert.equal(updated.title, "New");
  assert.equal(updated.content, "fresh");
  assert.equal(state.saved.length, 1);

  const cleared = await service.updatePrivateNote(NOTE_ID, "mentee-1", {
    title: " ",
    content: "",
  });
  assert.equal(cleared.title, "Untitled Note");
  assert.equal(cleared.content, "");
});

test("updatePrivateNote rejects unknown notes and non-authors, even session participants", async () => {
  await assert.rejects(
    createHarness().service.updatePrivateNote(NOTE_ID, "mentee-1", {}),
    { statusCode: 404, code: "PRIVATE_NOTE_NOT_FOUND" },
  );

  const { service, state } = createHarness({ state: { note: ownedNote() } });
  await assert.rejects(
    service.updatePrivateNote(NOTE_ID, "mentor-1", { title: "hijack" }),
    { statusCode: 403, code: "NOT_NOTE_AUTHOR" },
  );
  assert.equal(state.saved.length, 0);
});

test("removePrivateNote deletes only the author's note", async () => {
  const { service, state } = createHarness({ state: { note: ownedNote() } });
  await service.removePrivateNote(NOTE_ID, "mentee-1");
  assert.equal(state.deletedId, NOTE_ID);

  const other = createHarness({ state: { note: ownedNote() } });
  await assert.rejects(other.service.removePrivateNote(NOTE_ID, "mentor-1"), {
    statusCode: 403,
    code: "NOT_NOTE_AUTHOR",
  });
  assert.equal(other.state.deletedId, null);

  await assert.rejects(
    createHarness().service.removePrivateNote(NOTE_ID, "mentee-1"),
    { statusCode: 404 },
  );
});
