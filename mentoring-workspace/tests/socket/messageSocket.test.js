const test = require("node:test");
const assert = require("node:assert/strict");

const createMessageSocketHandler = require("../../socket/messageSocket");

const createHarness = ({
  userId = "mentee-1",
  requestOverrides = {},
  messageRepositoryOverrides = {},
  connectRequestRepositoryOverrides = {},
  notificationClient,
} = {}) => {
  const handlers = {};
  const roomEvents = [];
  let socketCounter = 0;
  const io = {
    on: (_event, handler) => { io.connectionHandler = handler; },
    to: () => ({ emit: (event, data) => roomEvents.push({ event, data }) }),
  };
  const request = { mentor: "mentor-1", mentee: "mentee-1", status: "ongoing", ...requestOverrides };
  const createdMessages = [];
  const messageRepository = {
    markMessagesAsRead: async () => {},
    createMessage: async (data) => {
      const message = { _id: "message-1", ...data, readAt: null, createdAt: "2099-01-01T10:00:00.000Z" };
      createdMessages.push(message);
      return message;
    },
    markMessageAsRead: async (id) => ({ ...createdMessages[0], _id: id, readAt: "2099-01-01T10:01:00.000Z" }),
    ...messageRepositoryOverrides,
  };
  const state = createMessageSocketHandler({
    io,
    messageService: {},
    messageRepository,
    connectRequestRepository: {
      findById: async () => request,
      ...connectRequestRepositoryOverrides,
    },
    notificationClient,
  });
  const createSocket = (socketUserId = userId) => {
    const socketHandlers = {};
    const socket = {
      id: `${socketUserId}-socket-${++socketCounter}`,
      user: { _id: socketUserId },
      currentRoom: null,
      emitted: [],
      joined: [],
      on: (event, handler) => { socketHandlers[event] = handler; },
      emit: (event, data) => socket.emitted.push({ event, data }),
      join: (room) => socket.joined.push(room),
      leave: () => {},
      to: () => ({ emit: (event, data) => roomEvents.push({ event, data }) }),
    };
    io.connectionHandler(socket);
    return { handlers: socketHandlers, socket };
  };
  const initialSocket = createSocket(userId);
  return {
    handlers: initialSocket.handlers,
    socket: initialSocket.socket,
    createSocket,
    roomEvents,
    createdMessages,
    request,
    messageRepository,
    onlineUsers: state.onlineUsers,
  };
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

test("tracks room presence, read receipts, typing relays, and disconnect cleanup", async () => {
  const { handlers, socket, roomEvents, onlineUsers, request, createSocket } = createHarness();
  const room = "507f1f77bcf86cd799439011";
  await handlers.join_room({ connectRequestId: room });
  assert.equal(onlineUsers.get(room).has("mentee-1"), true);

  await handlers.join_room({ connectRequestId: room });
  assert.equal(socket.emitted.some((event) => event.event === "user_online"), false);
  const mentor = createSocket("mentor-1");
  await mentor.handlers.join_room({ connectRequestId: room });
  assert.equal(mentor.socket.emitted.some((event) => event.event === "user_online" && event.data.userId === "mentee-1"), true);
  assert.equal(roomEvents.some((event) => event.event === "user_online" && event.data.userId === "mentor-1"), true);
  assert.equal(roomEvents.some((event) => event.event === "messages_read"), true);

  await handlers.typing_start({ connectRequestId: room });
  await handlers.typing_stop({ connectRequestId: room });
  assert.equal(roomEvents.filter((event) => event.event.startsWith("typing_")).length, 2);

  await handlers.mark_read({ connectRequestId: room });
  assert.equal(roomEvents.filter((event) => event.event === "messages_read").length, 3);

  request.status = "completed";
  await handlers.typing_start({ connectRequestId: room });
  assert.equal(socket.emitted.at(-1).data.code, "NOT_SESSION_PARTICIPANT");

  request.status = "ongoing";
  handlers.disconnect();
  assert.equal(onlineUsers.get(room).has("mentee-1"), false);
  assert.equal(roomEvents.at(-1).event, "user_offline");
  mentor.handlers.disconnect();
  assert.equal(onlineUsers.has(room), false);
  assert.equal(roomEvents.at(-1).event, "user_offline");
  handlers.disconnect();
});

test("keeps a user online until their last room socket disconnects", async () => {
  const first = createHarness();
  const room = "507f1f77bcf86cd799439011";
  await first.handlers.join_room({ connectRequestId: room });
  const second = first.createSocket("mentee-1");
  await second.handlers.join_room({ connectRequestId: room });

  assert.equal(first.onlineUsers.get(room).get("mentee-1").size, 2);
  first.handlers.disconnect();
  assert.equal(first.onlineUsers.get(room).has("mentee-1"), true);
  assert.equal(first.roomEvents.some((event) => event.event === "user_offline"), false);

  second.handlers.disconnect();
  assert.equal(first.onlineUsers.has(room), false);
  assert.equal(first.roomEvents.at(-1).event, "user_offline");
});

test("validates room access for each event and ignores malformed identity or state", async () => {
  const noRequest = createHarness({ connectRequestRepositoryOverrides: { findById: async () => null } });
  const room = "507f1f77bcf86cd799439011";
  await noRequest.handlers.join_room({ connectRequestId: room });
  await noRequest.handlers.mark_read({ connectRequestId: room });
  await noRequest.handlers.typing_stop({ connectRequestId: room });
  assert.equal(noRequest.socket.emitted.length, 3);
  assert.equal(noRequest.socket.emitted.every((event) => event.data.code === "NOT_SESSION_PARTICIPANT"), true);

  const invalidState = createHarness({ requestOverrides: { status: "accepted" } });
  await invalidState.handlers.join_room({ connectRequestId: room });
  assert.equal(invalidState.socket.emitted[0].data.code, "NOT_SESSION_PARTICIPANT");

  const notParticipant = createHarness({ userId: "outsider" });
  await notParticipant.handlers.join_room({ connectRequestId: room });
  assert.equal(notParticipant.socket.emitted[0].data.code, "NOT_SESSION_PARTICIPANT");

  const badContent = createHarness();
  await badContent.handlers.send_message({ connectRequestId: room, content: "x".repeat(5001) });
  assert.equal(badContent.socket.emitted[0].data.code, "INVALID_MESSAGE_CONTENT");
  await badContent.handlers.send_message({ connectRequestId: room, content: 4 });
  assert.equal(badContent.socket.emitted[1].data.code, "INVALID_MESSAGE_CONTENT");
});

test("marks new messages read for online recipients and publishes notification events", async () => {
  const published = [];
  const message = {
    _id: "message-2",
    sender: "mentee-1",
    content: "Hello",
    createdAt: "2099-01-01T10:00:00.000Z",
    toObject() {
      return {
        _id: this._id,
        sender: this.sender,
        content: this.content,
        createdAt: this.createdAt,
      };
    },
  };
  let markReadCalls = 0;
  const harness = createHarness({
    messageRepositoryOverrides: {
      createMessage: async (data) => ({ ...message, ...data }),
      markMessageAsRead: async (id) => {
        markReadCalls += 1;
        return { ...message, _id: id, readAt: "2099-01-01T10:01:00.000Z" };
      },
    },
    notificationClient: {
      publish: async (event) => published.push(event),
    },
  });
  const room = "507f1f77bcf86cd799439011";
  await harness.handlers.join_room({ connectRequestId: room });
  harness.onlineUsers.get(room).set("mentor-1", new Set(["mentor-1-socket"]));
  await harness.handlers.send_message({ connectRequestId: room, content: " hello " });
  assert.equal(markReadCalls, 1);
  assert.equal(published[0].recipient, "mentor-1");
  assert.equal(published[0].type, "new_message");
  assert.equal(harness.roomEvents.at(-1).data.readAt, "2099-01-01T10:01:00.000Z");
});
