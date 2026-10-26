const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const createApp = require("../../app");
const createMessageRouter = require("../../routes/message.routes");
const createMessageController = require("../../controllers/message.controller");
const createAuthenticate = require("../../middleware/authenticate");
const validations = require("../../middleware/messageValidation");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

test("message history and unread routes require authentication and return service data", async () => {
  const controller = createMessageController({
    messageService: {
      getChatHistory: async () => ({ messages: [], totalCount: 0, page: 1, limit: 30, hasMore: false }),
      getUnreadMessagesCount: async () => ({ unreadCount: 2 }),
    },
  });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    messageRouter: createMessageRouter({ controller, authenticate: createAuthenticate({ accessSecret: "test-secret" }), validations }),
  });
  try {
    const token = jwt.sign({ id: "mentee-1", type: "access" }, "test-secret");
    const headers = { Authorization: `Bearer ${token}` };
    const history = await fetch(`${serverDetails.url}/api/v1/messages/507f1f77bcf86cd799439011`, { headers });
    assert.equal(history.status, 200);
    assert.equal((await history.json()).data.totalCount, 0);
    const unread = await fetch(`${serverDetails.url}/api/v1/messages/507f1f77bcf86cd799439011/unread`, { headers });
    assert.equal(unread.status, 200);
    assert.equal((await unread.json()).data.unreadCount, 2);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("message routes reject malformed session identifiers", async () => {
  const controller = createMessageController({ messageService: { getChatHistory: async () => ({}) } });
  const serverDetails = await startServer({
    health: { isReady: () => true },
    messageRouter: createMessageRouter({ controller, authenticate: createAuthenticate({ accessSecret: "test-secret" }), validations }),
  });
  try {
    const token = jwt.sign({ id: "mentee-1", type: "access" }, "test-secret");
    const response = await fetch(`${serverDetails.url}/api/v1/messages/not-an-object-id`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_MESSAGE_CONTEXT");
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});
