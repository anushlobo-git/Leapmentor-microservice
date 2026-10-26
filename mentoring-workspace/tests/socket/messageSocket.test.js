const test = require("node:test");
const assert = require("node:assert/strict");

const createMessageSocketHandler = require("../../socket/messageSocket");

const createHarness = () => {
  const handlers = {};
  const roomEvents = [];
  const socket = {
    user: { _id: "mentee-1" },
    currentRoom: null,
    emitted: [],
    joined: [],
    on: (event, handler) => { handlers[event] = handler; },
    emit: (event, data) => socket.emitted.push({ event, data }),
    join: (room) => socket.joined.push(room),
    to: () => ({ emit: (event, data) => roomEvents.push({ event, data }) }),
  };
  const io = {
    on: (_event, handler) => { io.connectionHandler = handler; },
    to: () => ({ emit: (event, data) => roomEvents.push({ event, data }) }),
  };
  const request = { mentor: "mentor-1", mentee: "mentee-1", status: "ongoing" };
  const createdMessages = [];
  const messageRepository = {
    markMessagesAsRead: async () => {},
    createMessage: async (data) => {
      const message = { _id: "message-1", ...data, readAt: null, createdAt: "2099-01-01T10:00:00.000Z" };
      createdMessages.push(message);
      return message;
    },
    markMessageAsRead: async (id) => ({ ...createdMessages[0], _id: id, readAt: "2099-01-01T10:01:00.000Z" }),
  };
  createMessageSocketHandler({
    io,
    messageService: {},
    messageRepository,
    connectRequestRepository: { findById: async () => request },
  });
  io.connectionHandler(socket);
  return { handlers, socket, roomEvents, createdMessages };
};

test("joins only ongoing participant rooms, persists messages, and emits realtime events", async () => {
  const { handlers, socket, roomEvents, createdMessages } = createHarness();
  const room = "507f1f77bcf86cd799439011";
  await handlers.join_room({ connectRequestId: room });
  assert.deepEqual(socket.joined, [room]);

  await handlers.send_message({ connectRequestId: room, content: "  Hello there  " });
  assert.equal(createdMessages[0].content, "Hello there");
  assert.equal(roomEvents.at(-1).event, "new_message");
  assert.equal(roomEvents.at(-1).data.content, "Hello there");
});

test("rejects malformed message content and unauthorized room actions", async () => {
  const { handlers, socket } = createHarness();
  await handlers.send_message({ connectRequestId: "not-an-id", content: "Hello" });
  assert.equal(socket.emitted.at(-1).data.code, "NOT_SESSION_PARTICIPANT");
  await handlers.send_message({ connectRequestId: "507f1f77bcf86cd799439011", content: " " });
  assert.equal(socket.emitted.at(-1).data.code, "INVALID_MESSAGE_CONTENT");
});
