const { toMessageDTO } = require("../utils/message.mapper");

const ROOM_ID = /^[0-9a-fA-F]{24}$/;
const MAX_CONTENT_LENGTH = 5000;

const createMessageSocketHandler = ({ io, messageService, messageRepository, connectRequestRepository, notificationClient = { publish: async () => null } }) => {
  const onlineUsers = new Map();

  const getRoomContext = async (connectRequestId, userId) => {
    if (!ROOM_ID.test(String(connectRequestId || ""))) return null;
    const request = await connectRequestRepository.findById(connectRequestId);
    if (!request || request.status !== "ongoing") return null;
    if (![request.mentor, request.mentee].some((id) => String(id) === String(userId))) return null;
    return request;
  };

  const emitSocketError = (socket, message, code) => socket.emit("error", { message, code });

  io.on("connection", (socket) => {
    const userId = String(socket.user._id);

    socket.on("join_room", async ({ connectRequestId } = {}) => {
      const request = await getRoomContext(connectRequestId, userId);
      if (!request) return emitSocketError(socket, "Not authorized to join this room", "NOT_SESSION_PARTICIPANT");

      socket.join(connectRequestId);
      socket.currentRoom = connectRequestId;
      if (!onlineUsers.has(connectRequestId)) onlineUsers.set(connectRequestId, new Set());
      onlineUsers.get(connectRequestId).add(userId);
      socket.to(connectRequestId).emit("user_online", { userId });

      const readAt = new Date();
      await messageRepository.markMessagesAsRead(connectRequestId, userId);
      socket.to(connectRequestId).emit("messages_read", { connectRequestId, readBy: userId, readAt });
    });

    socket.on("send_message", async ({ connectRequestId, content } = {}) => {
      const normalizedContent = typeof content === "string" ? content.trim() : "";
      if (!normalizedContent || normalizedContent.length > MAX_CONTENT_LENGTH) {
        return emitSocketError(socket, "Message content must be between 1 and 5000 characters", "INVALID_MESSAGE_CONTENT");
      }

      const request = await getRoomContext(connectRequestId, userId);
      if (!request) return emitSocketError(socket, "Not authorized to send messages here", "NOT_SESSION_PARTICIPANT");

      const message = await messageRepository.createMessage({ connectRequest: connectRequestId, sender: userId, content: normalizedContent });
      const roomUsers = onlineUsers.get(connectRequestId) || new Set();
      const otherUserId = String(request.mentor) === userId ? String(request.mentee) : String(request.mentor);
      let messageDTO = toMessageDTO(message.toObject ? message.toObject() : message);
      if (roomUsers.has(otherUserId)) {
        const readMessage = await messageRepository.markMessageAsRead(message._id);
        messageDTO = toMessageDTO(readMessage || { ...messageDTO, readAt: new Date() });
      }
      io.to(connectRequestId).emit("new_message", messageDTO);
      const recipient = String(request.mentor) === userId ? request.mentee : request.mentor;
      await notificationClient.publish({
        sourceEventId: `workspace.message:${message._id}`,
        recipient,
        type: "new_message",
        title: "New message",
        message: "You received a new mentoring message.",
        metadata: { requestId: connectRequestId, sessionId: connectRequestId },
      });
    });

    const relayTyping = async (event, { connectRequestId } = {}) => {
      if (await getRoomContext(connectRequestId, userId)) socket.to(connectRequestId).emit(event, { userId });
      else emitSocketError(socket, "Not authorized to use this room", "NOT_SESSION_PARTICIPANT");
    };

    socket.on("typing_start", (payload) => relayTyping("typing_start", payload));
    socket.on("typing_stop", (payload) => relayTyping("typing_stop", payload));

    socket.on("mark_read", async ({ connectRequestId } = {}) => {
      if (!(await getRoomContext(connectRequestId, userId))) return emitSocketError(socket, "Not authorized to use this room", "NOT_SESSION_PARTICIPANT");
      const readAt = new Date();
      await messageRepository.markMessagesAsRead(connectRequestId, userId);
      socket.to(connectRequestId).emit("messages_read", { connectRequestId, readBy: userId, readAt });
    });

    socket.on("disconnect", () => {
      const room = socket.currentRoom;
      if (!room || !onlineUsers.has(room)) return;
      const users = onlineUsers.get(room);
      users.delete(userId);
      if (users.size === 0) onlineUsers.delete(room);
      socket.to(room).emit("user_offline", { userId });
    });
  });

  return { onlineUsers };
};

module.exports = createMessageSocketHandler;
