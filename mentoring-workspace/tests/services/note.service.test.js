const test = require("node:test");
const assert = require("node:assert/strict");

const createNoteService = require("../../services/note.service");
const AppError = require("../../utils/AppError");
const { getFileType } = require("../../utils/fileType");

const REQUEST_ID = "507f1f77bcf86cd799439011";
const MENTOR = "507f1f77bcf86cd799439031";
const MENTEE = "507f1f77bcf86cd799439032";
const NOTE_ID = "507f1f77bcf86cd799439041";

const file = {
  buffer: Buffer.from("hello"),
  originalname: "plan.pdf",
  mimetype: "application/pdf",
  size: 5,
};

const build = (overrides = {}) => {
  const calls = {
    created: [],
    destroyed: [],
    deleted: [],
    uploads: [],
    warnings: [],
    order: [],
  };
  const deps = {
    connectRequestRepository: {
      findById: async () => ({
        _id: REQUEST_ID,
        mentor: MENTOR,
        mentee: MENTEE,
        status: "ongoing",
      }),
    },
    noteRepository: {
      create: async (data) => {
        calls.created.push(data);
        return { _id: NOTE_ID, createdAt: "t", updatedAt: "t", ...data };
      },
      findById: async () => ({
        _id: NOTE_ID,
        uploadedBy: MENTOR,
        publicId: "leapmentor/notes/x",
      }),
      findSharedByConnectRequest: async () => [],
      findPrivateByConnectRequestAndUser: async () => [],
      deleteById: async (id) => {
        calls.order.push("db");
        calls.deleted.push(id);
      },
    },
    cloudinaryClient: {
      uploadRawBuffer: async (buffer, options) => {
        calls.uploads.push({ buffer, options });
        return {
          url: "https://cdn.test/plan.pdf",
          publicId: "leapmentor/notes/x",
        };
      },
      destroyRawAsset: async (publicId) => {
        calls.order.push("cloud");
        calls.destroyed.push(publicId);
      },
    },
    identityClient: {
      getUserSummaryMap: async () =>
        new Map([[MENTOR, { _id: MENTOR, name: "Maya", email: "m@x.test" }]]),
    },
    getFileType,
    logger: { warn: (message, meta) => calls.warnings.push({ message, meta }) },
    ...overrides,
  };
  return { service: createNoteService(deps), calls, deps };
};

const rejects = async (promise, status, code) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.statusCode, status);
    assert.equal(error.code, code);
    return true;
  });
};

test("upload stores the file, records the mentor role and decorates the uploader", async () => {
  const { service, calls } = build();
  const note = await service.processNoteUpload(
    REQUEST_ID,
    MENTOR,
    file,
    { title: "  Agenda  " },
    "corr-1",
  );

  assert.equal(
    calls.uploads[0].options.folder,
    `leapmentor/notes/${REQUEST_ID}`,
  );
  assert.deepEqual(calls.uploads[0].buffer, file.buffer);
  assert.equal(calls.created[0].uploaderRole, "mentor");
  assert.equal(calls.created[0].title, "Agenda");
  assert.equal(calls.created[0].fileType, "pdf");
  assert.equal(calls.created[0].fileSize, 5);
  assert.equal(calls.created[0].isPrivate, false);
  assert.equal(note.fileUrl, "https://cdn.test/plan.pdf");
  assert.deepEqual(note.uploadedBy, {
    _id: MENTOR,
    id: MENTOR,
    name: "Maya",
    email: "m@x.test",
  });
});

test("upload records the mentee role, a private flag and a filename title fallback", async () => {
  const { service, calls } = build();
  await service.processNoteUpload(REQUEST_ID, MENTEE, file, {
    isPrivate: "true",
  });
  assert.equal(calls.created[0].uploaderRole, "mentee");
  assert.equal(calls.created[0].isPrivate, true);
  assert.equal(calls.created[0].title, "plan.pdf");
});

test("upload still succeeds with a plain uploadedBy ID when Identity is down", async () => {
  const { service, calls } = build({
    identityClient: {
      getUserSummaryMap: async () => {
        throw new Error("identity unreachable");
      },
    },
  });
  const note = await service.processNoteUpload(
    REQUEST_ID,
    MENTOR,
    file,
    {},
    "corr-2",
  );
  assert.equal(note.uploadedBy, MENTOR);
  assert.equal(calls.warnings[0].meta.correlationId, "corr-2");
});

test("upload validates input and session access before touching Cloudinary", async () => {
  const noUpload = {
    uploadRawBuffer: async () => {
      throw new Error("must not be called");
    },
    destroyRawAsset: async () => {},
  };
  const base = { cloudinaryClient: noUpload };
  await rejects(
    build(base).service.processNoteUpload("", MENTOR, file, {}),
    400,
    "CONNECT_REQUEST_REQUIRED",
  );
  await rejects(
    build(base).service.processNoteUpload(REQUEST_ID, MENTOR, undefined, {}),
    400,
    "NOTE_FILE_REQUIRED",
  );
  await rejects(
    build(base).service.processNoteUpload(REQUEST_ID, "stranger", file, {}),
    403,
    "NOT_SESSION_PARTICIPANT",
  );

  const missing = build({
    ...base,
    connectRequestRepository: { findById: async () => null },
  });
  await rejects(
    missing.service.processNoteUpload(REQUEST_ID, MENTOR, file, {}),
    404,
    "SESSION_NOT_FOUND",
  );

  const inactive = build({
    ...base,
    connectRequestRepository: {
      findById: async () => ({
        mentor: MENTOR,
        mentee: MENTEE,
        status: "pending",
      }),
    },
  });
  await rejects(
    inactive.service.processNoteUpload(REQUEST_ID, MENTOR, file, {}),
    400,
    "SESSION_INACTIVE",
  );

  const completed = build({
    ...base,
    connectRequestRepository: {
      findById: async () => ({
        mentor: MENTOR,
        mentee: MENTEE,
        status: "completed",
      }),
    },
  });
  await rejects(
    completed.service.processNoteUpload(REQUEST_ID, MENTOR, file, {}),
    400,
    "SESSION_COMPLETED",
  );
});

test("upload maps a provider failure to 502 and creates no record", async () => {
  const { service, calls } = build({
    cloudinaryClient: {
      uploadRawBuffer: async () => {
        throw new Error("cloudinary exploded");
      },
      destroyRawAsset: async () => {},
    },
  });
  await rejects(
    service.processNoteUpload(REQUEST_ID, MENTOR, file, {}),
    502,
    "UPLOAD_PROVIDER_FAILED",
  );
  assert.equal(calls.created.length, 0);
});

test("upload keeps the 503 raised when Cloudinary is not configured", async () => {
  const { service } = build({
    cloudinaryClient: {
      uploadRawBuffer: async () => {
        throw new AppError(
          "not configured",
          503,
          "UPLOAD_PROVIDER_NOT_CONFIGURED",
        );
      },
      destroyRawAsset: async () => {},
    },
  });
  await rejects(
    service.processNoteUpload(REQUEST_ID, MENTOR, file, {}),
    503,
    "UPLOAD_PROVIDER_NOT_CONFIGURED",
  );
});

test("upload removes the stored asset when the database write fails", async () => {
  const failing = build({
    noteRepository: {
      create: async () => {
        throw new Error("mongo down");
      },
    },
  });
  await assert.rejects(
    failing.service.processNoteUpload(REQUEST_ID, MENTOR, file, {}),
    /mongo down/,
  );
  assert.deepEqual(failing.calls.destroyed, ["leapmentor/notes/x"]);
});

test("shared list is decorated with one Identity lookup and falls back per user", async () => {
  let lookups = 0;
  const other = "507f1f77bcf86cd799439099";
  const { service } = build({
    noteRepository: {
      findSharedByConnectRequest: async () => [
        { _id: "n1", connectRequest: REQUEST_ID, uploadedBy: MENTOR },
        { _id: "n2", connectRequest: REQUEST_ID, uploadedBy: other },
      ],
    },
    identityClient: {
      getUserSummaryMap: async (ids) => {
        lookups += 1;
        assert.equal(ids.length, 2);
        return new Map([[MENTOR, { name: "Maya", email: "m@x.test" }]]);
      },
    },
  });
  const notes = await service.getSharedNotesList(REQUEST_ID, MENTEE);
  assert.equal(lookups, 1);
  assert.equal(notes[0].uploadedBy.name, "Maya");
  assert.equal(notes[1].uploadedBy, other);
});

test("lists skip Identity when empty, require participation, and scope private notes to the caller", async () => {
  let identityCalls = 0;
  let privateArgs;
  const { service } = build({
    noteRepository: {
      findSharedByConnectRequest: async () => [],
      findPrivateByConnectRequestAndUser: async (...args) => {
        privateArgs = args;
        return [];
      },
    },
    identityClient: {
      getUserSummaryMap: async () => {
        identityCalls += 1;
        return new Map();
      },
    },
  });
  assert.deepEqual(await service.getSharedNotesList(REQUEST_ID, MENTOR), []);
  assert.deepEqual(await service.getPrivateNotesList(REQUEST_ID, MENTEE), []);
  assert.deepEqual(privateArgs, [REQUEST_ID, MENTEE]);
  assert.equal(identityCalls, 0);
  await rejects(
    service.getSharedNotesList(REQUEST_ID, "stranger"),
    403,
    "NOT_SESSION_PARTICIPANT",
  );
  await rejects(
    service.getPrivateNotesList(REQUEST_ID, "stranger"),
    403,
    "NOT_SESSION_PARTICIPANT",
  );
});

test("delete removes the record first, then the Cloudinary asset", async () => {
  const { service, calls } = build();
  await service.removeNoteRecord(NOTE_ID, MENTOR);
  assert.deepEqual(calls.order, ["db", "cloud"]);
  assert.deepEqual(calls.deleted, [NOTE_ID]);
  assert.deepEqual(calls.destroyed, ["leapmentor/notes/x"]);
});

test("delete only lets the uploader remove a note", async () => {
  const { service, calls } = build();
  await rejects(
    service.removeNoteRecord(NOTE_ID, MENTEE),
    403,
    "NOT_NOTE_UPLOADER",
  );
  assert.equal(calls.deleted.length, 0);

  const missing = build({ noteRepository: { findById: async () => null } });
  await rejects(
    missing.service.removeNoteRecord(NOTE_ID, MENTOR),
    404,
    "NOTE_NOT_FOUND",
  );
});

test("delete succeeds and logs when asset cleanup fails, and keeps the asset when the record cannot be deleted", async () => {
  const cleanupFails = build({
    cloudinaryClient: {
      destroyRawAsset: async () => {
        throw new Error("cloudinary 500");
      },
    },
  });
  await cleanupFails.service.removeNoteRecord(NOTE_ID, MENTOR, "corr-3");
  assert.equal(
    cleanupFails.calls.warnings[0].meta.publicId,
    "leapmentor/notes/x",
  );

  const dbFails = build({
    noteRepository: {
      findById: async () => ({
        _id: NOTE_ID,
        uploadedBy: MENTOR,
        publicId: "p",
      }),
      deleteById: async () => {
        throw new Error("mongo down");
      },
    },
  });
  await assert.rejects(
    dbFails.service.removeNoteRecord(NOTE_ID, MENTOR),
    /mongo down/,
  );
  assert.equal(dbFails.calls.destroyed.length, 0);
});
