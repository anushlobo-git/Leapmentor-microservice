// services/mentoring-workspace/socket/realtimePublisher.js

/**
 * Realtime publisher port for Mentoring Workspace.
 *
 * Business services (goals now; connect requests and sessions later) call
 * publishToRoom / publishToUser instead of touching Socket.IO directly.
 * The Socket.IO server is created in server.js after the container is built,
 * so the publisher is created unbound and attach(io) binds it at startup.
 * Until it is attached (unit tests, scripts) every publish is a safe no-op.
 *
 * Event names and payload shapes are passed through unchanged, so the
 * frontend contract stays identical to the monolith.
 */
const USER_ROOM_PREFIX = "user:";

const createRealtimePublisher = () => {
  let io = null;

  const attach = (socketServer) => {
    io = socketServer;

    // Every authenticated socket joins a private per-user room. This lets
    // publishToUser reach all of a user's tabs/devices without a local
    // socket map, and it keeps working with the Socket.IO Redis adapter.
    io.on("connection", (socket) => {
      const userId = socket.user?._id;
      if (userId) socket.join(`${USER_ROOM_PREFIX}${String(userId)}`);
    });
  };

  const publishToRoom = (roomId, event, payload) => {
    if (!io || !roomId || !event) return false;
    io.to(String(roomId)).emit(event, payload);
    return true;
  };

  const publishToUser = (userId, event, payload) => {
    if (!io || !userId || !event) return false;
    io.to(`${USER_ROOM_PREFIX}${String(userId)}`).emit(event, payload);
    return true;
  };

  return { attach, publishToRoom, publishToUser };
};

module.exports = createRealtimePublisher;
