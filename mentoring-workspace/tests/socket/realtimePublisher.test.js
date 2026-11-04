const test = require("node:test");
const assert = require("node:assert/strict");

const createRealtimePublisher = require("../../socket/realtimePublisher");

const createFakeIo = () => {
  const emitted = [];
  const io = {
    emitted,
    on: (_event, handler) => {
      io.connectionHandler = handler;
    },
    to: (room) => ({
      emit: (event, payload) => emitted.push({ room, event, payload }),
    }),
  };
  return io;
};

test("publish calls are safe no-ops before the Socket.IO server is attached", () => {
  const publisher = createRealtimePublisher();
  assert.equal(publisher.publishToRoom("room-1", "goal_created", {}), false);
  assert.equal(publisher.publishToUser("user-1", "notification", {}), false);
});

test("publishToRoom emits the unchanged event name and payload to the room", () => {
  const io = createFakeIo();
  const publisher = createRealtimePublisher();
  publisher.attach(io);

  assert.equal(
    publisher.publishToRoom("507f1f77bcf86cd799439011", "goal_updated", {
      goal: { title: "x" },
    }),
    true,
  );
  assert.deepEqual(io.emitted, [
    {
      room: "507f1f77bcf86cd799439011",
      event: "goal_updated",
      payload: { goal: { title: "x" } },
    },
  ]);
});

test("publishToUser targets the per-user room that each authenticated socket joins", () => {
  const io = createFakeIo();
  const publisher = createRealtimePublisher();
  publisher.attach(io);

  const joined = [];
  io.connectionHandler({
    user: { _id: "user-1" },
    join: (room) => joined.push(room),
  });
  io.connectionHandler({ join: (room) => joined.push(room) });
  assert.deepEqual(joined, ["user:user-1"]);

  assert.equal(
    publisher.publishToUser("user-1", "notification_created", { id: 1 }),
    true,
  );
  assert.deepEqual(io.emitted, [
    { room: "user:user-1", event: "notification_created", payload: { id: 1 } },
  ]);
});

test("publish ignores missing targets or event names", () => {
  const io = createFakeIo();
  const publisher = createRealtimePublisher();
  publisher.attach(io);
  assert.equal(publisher.publishToRoom("", "event", {}), false);
  assert.equal(publisher.publishToRoom("room", "", {}), false);
  assert.equal(publisher.publishToUser(null, "event", {}), false);
  assert.equal(io.emitted.length, 0);
});
