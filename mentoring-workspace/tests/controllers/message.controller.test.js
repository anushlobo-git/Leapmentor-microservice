const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/message.controller");

const invoke = async (handler, req) => {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let error;
  await handler(req, res, (value) => { error = value; });
  return { res, error };
};

test("message controller returns chat history and unread counts for the current user", async () => {
  const calls = [];
  const controller = createController({
    messageService: {
      getChatHistory: async (...args) => {
        calls.push(["history", ...args]);
        return [{ content: "Hello" }];
      },
      getUnreadMessagesCount: async (...args) => {
        calls.push(["unread", ...args]);
        return 2;
      },
    },
  });
  const req = {
    params: { connectRequestId: "request-1" },
    user: { _id: "user-1" },
    query: { page: "2" },
  };
  const history = await invoke(controller.getMessages, req);
  assert.equal(history.res.statusCode, 200);
  assert.equal(history.res.body.data[0].content, "Hello");
  const unread = await invoke(controller.getUnreadCount, req);
  assert.equal(unread.res.statusCode, 200);
  assert.equal(unread.res.body.data, 2);
  assert.deepEqual(calls, [
    ["history", "request-1", "user-1", req.query],
    ["unread", "request-1", "user-1"],
  ]);
});

test("message controller forwards service errors", async () => {
  const failure = new Error("message service failed");
  const controller = createController({
    messageService: {
      getChatHistory: async () => { throw failure; },
      getUnreadMessagesCount: async () => { throw failure; },
    },
  });
  const req = { params: { connectRequestId: "request-1" }, user: { _id: "user-1" } };
  assert.equal((await invoke(controller.getMessages, req)).error, failure);
  assert.equal((await invoke(controller.getUnreadCount, req)).error, failure);
});
