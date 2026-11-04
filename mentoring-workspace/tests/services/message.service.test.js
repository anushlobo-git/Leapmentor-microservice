const test = require("node:test");
const assert = require("node:assert/strict");

const createMessageService = require("../../services/message.service");

const createService = (overrides = {}) => {
  const request = { _id: "request-1", mentor: "mentor-1", mentee: "mentee-1" };
  const messages = [
    { _id: "message-1", connectRequest: "request-1", sender: "mentor-1", content: "Welcome", readAt: null, createdAt: "2099-01-01T10:00:00.000Z" },
    { _id: "message-2", connectRequest: "request-1", sender: "mentee-1", content: "Thanks", readAt: null, createdAt: "2099-01-01T10:01:00.000Z" },
  ];
  const calls = { markedRead: null };
  const repository = {
    findById: async () => request,
    findPaginatedMessages: async () => messages,
    countMessages: async () => messages.length,
    markMessagesAsRead: async (...args) => { calls.markedRead = args; },
    countUnreadMessages: async () => 1,
    ...overrides.repository,
  };
  return { service: createMessageService({ messageRepository: repository, connectRequestRepository: repository }), calls };
};

test("returns paginated messages and marks incoming messages read for a participant", async () => {
  const { service, calls } = createService();
  const result = await service.getChatHistory("request-1", "mentee-1", { page: 1, limit: 10 });
  assert.equal(result.totalCount, 2);
  assert.equal(result.messages[0].content, "Welcome");
  assert.deepEqual(calls.markedRead, ["request-1", "mentee-1"]);
});

test("returns unread count only to a session participant", async () => {
  const { service } = createService();
  assert.deepEqual(await service.getUnreadMessagesCount("request-1", "mentor-1"), { unreadCount: 1 });
  await assert.rejects(service.getUnreadMessagesCount("request-1", "outsider"), { statusCode: 403, code: "NOT_SESSION_PARTICIPANT" });
});

test("rejects messages for a missing session context", async () => {
  const { service } = createService({ repository: { findById: async () => null } });
  await assert.rejects(service.getChatHistory("request-1", "mentee-1"), { statusCode: 404, code: "SESSION_NOT_FOUND" });
});
