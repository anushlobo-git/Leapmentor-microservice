const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createPrivateNoteRouter = require("../../routes/privateNote.routes");
const createPrivateNoteController = require("../../controllers/privateNote.controller");
const createAuthenticate = require("../../middleware/authenticate");
const validations = require("../../middleware/privateNoteValidation");

const REQUEST_ID = "507f1f77bcf86cd799439011";
const NOTE_ID = "507f1f77bcf86cd799439021";

const withServer = async (privateNoteService, run, { ready = true } = {}) => {
  const controller = createPrivateNoteController({ privateNoteService });
  const privateNoteRouter = createPrivateNoteRouter({
    controller,
    authenticate: createAuthenticate({ accessSecret: "test-secret" }),
    validations,
  });
  const server = http.createServer(
    createApp({ health: { isReady: () => ready }, privateNoteRouter }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  const token = jwt.sign({ id: "mentee-1", type: "access" }, "test-secret");
  try {
    await run({
      url: `http://127.0.0.1:${server.address().port}/api/v1/private-notes`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test("private note routes require a bearer token and MongoDB readiness", async () => {
  await withServer({}, async ({ url }) => {
    assert.equal((await fetch(`${url}/${REQUEST_ID}`)).status, 401);
  });
  await withServer(
    {},
    async ({ url, headers }) => {
      const response = await fetch(`${url}/${REQUEST_ID}`, { headers });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "SERVICE_NOT_READY");
    },
    { ready: false },
  );
});

test("POST /private-notes creates a note for the authenticated user only", async () => {
  let received;
  await withServer(
    {
      createPrivateNote: async (userId, body) => {
        received = { userId, body };
        return { _id: NOTE_ID, title: body.title };
      },
    },
    async ({ url, headers }) => {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          connectRequestId: REQUEST_ID,
          title: "Plan",
          content: "text",
          author: "spoofed",
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 201);
      assert.equal(body.data.note.title, "Plan");
      assert.equal(body.message, "Private note created");
      assert.equal(received.userId, "mentee-1");
    },
  );
});

test("POST /private-notes rejects invalid bodies", async () => {
  await withServer(
    {
      createPrivateNote: async () => {
        throw new Error("must not be called");
      },
    },
    async ({ url, headers }) => {
      const send = (payload) =>
        fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
      assert.equal((await send({})).status, 400);
      assert.equal((await send({ connectRequestId: "bad" })).status, 400);
      assert.equal(
        (await send({ connectRequestId: REQUEST_ID, title: 5 })).status,
        400,
      );
      assert.equal(
        (await send({ connectRequestId: REQUEST_ID, title: "x".repeat(201) }))
          .status,
        400,
      );
      assert.equal(
        (
          await send({
            connectRequestId: REQUEST_ID,
            content: "x".repeat(20001),
          })
        ).status,
        400,
      );
      const noBody = await fetch(url, {
        method: "POST",
        headers: { Authorization: headers.Authorization },
      });
      assert.equal(noBody.status, 400);
      assert.equal((await noBody.json()).code, "INVALID_PRIVATE_NOTE_REQUEST");
    },
  );
});

test("GET /private-notes/:connectRequestId lists notes and validates the id", async () => {
  await withServer(
    {
      getPrivateNotesList: async (id, userId) => [
        { _id: NOTE_ID, connectRequest: id, author: userId },
      ],
    },
    async ({ url, headers }) => {
      const ok = await fetch(`${url}/${REQUEST_ID}`, { headers });
      const body = await ok.json();
      assert.equal(ok.status, 200);
      assert.equal(body.data.notes[0].author, "mentee-1");
      assert.equal((await fetch(`${url}/not-an-id`, { headers })).status, 400);
    },
  );
});

test("PATCH /private-notes/:id updates, validates, and tolerates a missing body", async () => {
  await withServer(
    {
      updatePrivateNote: async (id, userId, body) => ({
        _id: id,
        title: body.title ?? "kept",
      }),
    },
    async ({ url, headers }) => {
      const ok = await fetch(`${url}/${NOTE_ID}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ title: "Renamed" }),
      });
      assert.equal(ok.status, 200);
      assert.equal((await ok.json()).data.note.title, "Renamed");

      const empty = await fetch(`${url}/${NOTE_ID}`, {
        method: "PATCH",
        headers: { Authorization: headers.Authorization },
      });
      assert.equal(empty.status, 200);

      assert.equal(
        (await fetch(`${url}/bad-id`, { method: "PATCH", headers, body: "{}" }))
          .status,
        400,
      );
      assert.equal(
        (
          await fetch(`${url}/${NOTE_ID}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ content: 12 }),
          })
        ).status,
        400,
      );
    },
  );
});

test("DELETE /private-notes/:id deletes and validates the id", async () => {
  let deleted;
  await withServer(
    {
      removePrivateNote: async (id, userId) => {
        deleted = [id, userId];
      },
    },
    async ({ url, headers }) => {
      const ok = await fetch(`${url}/${NOTE_ID}`, {
        method: "DELETE",
        headers,
      });
      const body = await ok.json();
      assert.equal(ok.status, 200);
      assert.equal(body.data, null);
      assert.equal(body.message, "Note deleted successfully");
      assert.deepEqual(deleted, [NOTE_ID, "mentee-1"]);
      assert.equal(
        (await fetch(`${url}/bad-id`, { method: "DELETE", headers })).status,
        400,
      );
    },
  );
});

test("service errors keep their status and error code", async () => {
  const error = Object.assign(
    new Error("You can only edit your own private notes"),
    { statusCode: 403, code: "NOT_NOTE_AUTHOR" },
  );
  await withServer(
    {
      updatePrivateNote: async () => {
        throw error;
      },
    },
    async ({ url, headers }) => {
      const response = await fetch(`${url}/${NOTE_ID}`, {
        method: "PATCH",
        headers,
        body: "{}",
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, "NOT_NOTE_AUTHOR");
    },
  );
});
