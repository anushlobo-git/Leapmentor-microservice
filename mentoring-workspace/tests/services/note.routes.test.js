const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createNoteRouter = require("../../routes/note.routes");
const createNoteController = require("../../controllers/note.controller");
const createAuthenticate = require("../../middleware/authenticate");
const validations = require("../../middleware/noteValidation");
const {
  createNoteUpload,
  MAX_FILE_SIZE_BYTES,
} = require("../../middleware/noteUpload");

const REQUEST_ID = "507f1f77bcf86cd799439011";
const NOTE_ID = "507f1f77bcf86cd799439041";

const withServer = async (noteService, run, { ready = true } = {}) => {
  const noteRouter = createNoteRouter({
    controller: createNoteController({ noteService }),
    authenticate: createAuthenticate({ accessSecret: "test-secret" }),
    upload: createNoteUpload(),
    validations,
  });
  const server = http.createServer(
    createApp({ health: { isReady: () => ready }, noteRouter }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  const token = jwt.sign({ id: "mentee-1", type: "access" }, "test-secret");
  try {
    await run({
      url: `http://127.0.0.1:${server.address().port}/api/v1/notes`,
      auth: { Authorization: `Bearer ${token}` },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const form = ({
  connectRequestId = REQUEST_ID,
  file = true,
  type = "application/pdf",
  size = 5,
  ...fields
} = {}) => {
  const data = new FormData();
  if (connectRequestId !== null)
    data.append("connectRequestId", connectRequestId);
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  if (file)
    data.append(
      "file",
      new Blob([Buffer.alloc(size, "a")], { type }),
      "plan.pdf",
    );
  return data;
};

const forbidden = () => {
  throw new Error("must not be called");
};

test("note routes require a bearer token and MongoDB readiness", async () => {
  await withServer({}, async ({ url }) => {
    assert.equal((await fetch(`${url}/${REQUEST_ID}`)).status, 401);
    assert.equal(
      (await fetch(`${url}/upload`, { method: "POST", body: form() })).status,
      401,
    );
    assert.equal(
      (await fetch(`${url}/${NOTE_ID}`, { method: "DELETE" })).status,
      401,
    );
  });
  await withServer(
    {},
    async ({ url, auth }) => {
      const response = await fetch(`${url}/${REQUEST_ID}`, { headers: auth });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "SERVICE_NOT_READY");
    },
    { ready: false },
  );
});

test("POST /notes/upload passes the file and fields to the service for the authenticated user", async () => {
  let received;
  await withServer(
    {
      processNoteUpload: async (
        connectRequestId,
        userId,
        file,
        fields,
        correlationId,
      ) => {
        received = { connectRequestId, userId, file, fields, correlationId };
        return { _id: NOTE_ID, title: fields.title };
      },
    },
    async ({ url, auth }) => {
      const response = await fetch(`${url}/upload`, {
        method: "POST",
        headers: { ...auth, "X-Correlation-ID": "corr-9" },
        body: form({
          title: "Agenda",
          isPrivate: "true",
          uploadedBy: "spoofed",
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.success, true);
      assert.equal(body.message, "Note uploaded successfully");
      assert.equal(body.data.note.title, "Agenda");
      assert.equal(received.connectRequestId, REQUEST_ID);
      assert.equal(received.userId, "mentee-1");
      assert.equal(received.file.originalname, "plan.pdf");
      assert.equal(received.file.mimetype, "application/pdf");
      assert.equal(received.file.size, 5);
      assert.equal(received.fields.isPrivate, true);
      assert.equal(received.correlationId, "corr-9");
    },
  );
});

test("POST /notes/upload rejects invalid fields before reaching the service", async () => {
  await withServer({ processNoteUpload: forbidden }, async ({ url, auth }) => {
    const send = (data) =>
      fetch(`${url}/upload`, { method: "POST", headers: auth, body: data });

    const noId = await send(form({ connectRequestId: null }));
    assert.equal(noId.status, 400);
    assert.equal((await noId.json()).code, "INVALID_NOTE_REQUEST");
    assert.equal((await send(form({ connectRequestId: "bad" }))).status, 400);
    assert.equal((await send(form({ title: "x".repeat(201) }))).status, 400);
    assert.equal((await send(form({ isPrivate: "maybe" }))).status, 400);
  });
});

test("POST /notes/upload maps multer errors: wrong type 400, oversize 413, wrong field name 400", async () => {
  await withServer({ processNoteUpload: forbidden }, async ({ url, auth }) => {
    const send = (data) =>
      fetch(`${url}/upload`, { method: "POST", headers: auth, body: data });

    const wrongType = await send(form({ type: "application/zip" }));
    assert.equal(wrongType.status, 400);
    assert.match((await wrongType.json()).message, /File type not allowed/);

    const tooBig = await send(form({ size: MAX_FILE_SIZE_BYTES + 1 }));
    assert.equal(tooBig.status, 413);
    assert.equal((await tooBig.json()).code, "LIMIT_FILE_SIZE");

    const wrongField = new FormData();
    wrongField.append("connectRequestId", REQUEST_ID);
    wrongField.append(
      "document",
      new Blob(["x"], { type: "application/pdf" }),
      "a.pdf",
    );
    assert.equal((await send(wrongField)).status, 400);
  });
});

test("POST /notes/upload without a file reaches the service, which decides the error", async () => {
  await withServer(
    {
      processNoteUpload: async (_id, _user, file) => {
        assert.equal(file, undefined);
        const error = new Error("A file is required");
        error.statusCode = 400;
        error.code = "NOTE_FILE_REQUIRED";
        throw error;
      },
    },
    async ({ url, auth }) => {
      const response = await fetch(`${url}/upload`, {
        method: "POST",
        headers: auth,
        body: form({ file: false }),
      });
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, "NOTE_FILE_REQUIRED");
    },
  );
});

test("GET /notes/:id lists shared notes and /private lists the caller's own, on distinct handlers", async () => {
  const seen = [];
  await withServer(
    {
      getSharedNotesList: async (connectRequestId, userId) => {
        seen.push(["shared", connectRequestId, userId]);
        return [{ _id: "s1" }];
      },
      getPrivateNotesList: async (connectRequestId, userId) => {
        seen.push(["private", connectRequestId, userId]);
        return [{ _id: "p1" }];
      },
    },
    async ({ url, auth }) => {
      const shared = await fetch(`${url}/${REQUEST_ID}`, { headers: auth });
      assert.equal(shared.status, 200);
      const sharedBody = await shared.json();
      assert.equal(sharedBody.message, "Notes retrieved");
      assert.deepEqual(sharedBody.data.notes, [{ _id: "s1" }]);

      const priv = await fetch(`${url}/${REQUEST_ID}/private`, {
        headers: auth,
      });
      assert.equal(priv.status, 200);
      const privBody = await priv.json();
      assert.equal(privBody.message, "Private notes retrieved");
      assert.deepEqual(privBody.data.notes, [{ _id: "p1" }]);

      assert.deepEqual(seen, [
        ["shared", REQUEST_ID, "mentee-1"],
        ["private", REQUEST_ID, "mentee-1"],
      ]);
    },
  );
});

test("GET and DELETE reject malformed ids", async () => {
  await withServer(
    {
      getSharedNotesList: forbidden,
      getPrivateNotesList: forbidden,
      removeNoteRecord: forbidden,
    },
    async ({ url, auth }) => {
      assert.equal(
        (await fetch(`${url}/not-an-id`, { headers: auth })).status,
        400,
      );
      assert.equal(
        (await fetch(`${url}/not-an-id/private`, { headers: auth })).status,
        400,
      );
      const del = await fetch(`${url}/not-an-id`, {
        method: "DELETE",
        headers: auth,
      });
      assert.equal(del.status, 400);
      assert.equal((await del.json()).code, "INVALID_NOTE_REQUEST");
    },
  );
});

test("DELETE /notes/:id succeeds with data null and passes service errors through", async () => {
  let removed;
  await withServer(
    {
      removeNoteRecord: async (noteId, userId) => {
        removed = [noteId, userId];
      },
    },
    async ({ url, auth }) => {
      const response = await fetch(`${url}/${NOTE_ID}`, {
        method: "DELETE",
        headers: auth,
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.data, null);
      assert.equal(body.message, "Note deleted successfully");
      assert.deepEqual(removed, [NOTE_ID, "mentee-1"]);
    },
  );

  await withServer(
    {
      removeNoteRecord: async () => {
        const error = new Error("You can only delete your own notes");
        error.statusCode = 403;
        error.code = "NOT_NOTE_UPLOADER";
        throw error;
      },
    },
    async ({ url, auth }) => {
      const response = await fetch(`${url}/${NOTE_ID}`, {
        method: "DELETE",
        headers: auth,
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, "NOT_NOTE_UPLOADER");
    },
  );
});
