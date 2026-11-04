const test = require("node:test");
const assert = require("node:assert/strict");

const createAvailabilityRepository = require("../../repositories/availability.repository");

test("creates availability with repository defaults", async () => {
  const calls = [];
  const repository = createAvailabilityRepository({
    create: async (data) => {
      calls.push(data);
      return data;
    },
  });

  await repository.createAvailability({ mentorId: "mentor-1" });
  assert.deepEqual(calls[0], {
    mentor: "mentor-1",
    timezone: "Asia/Kolkata",
    sessionDurations: [30, 60],
    specificDates: [],
    weeklyHours: undefined,
  });
});

test("updates availability with validators and upsert enabled", async () => {
  const calls = [];
  const repository = createAvailabilityRepository({
    findOneAndUpdate: async (...args) => {
      calls.push(args);
      return { timezone: "UTC" };
    },
  });

  await repository.updateAvailability("mentor-1", { timezone: "UTC" });
  assert.deepEqual(calls[0], [
    { mentor: "mentor-1" },
    { $set: { timezone: "UTC" } },
    { new: true, runValidators: true, upsert: true },
  ]);
});

test("stores calendar credentials with validators and exposes the token only for calendar reads", async () => {
  const calls = [];
  const query = {
    select: (...args) => {
      calls.push(["select", ...args]);
      return Promise.resolve({ googleCalendarToken: "token" });
    },
  };
  const repository = createAvailabilityRepository({
    findOneAndUpdate: (...args) => {
      calls.push(["update", ...args]);
      return Promise.resolve({ googleCalendarConnected: true });
    },
    findOne: (...args) => {
      calls.push(["find", ...args]);
      return query;
    },
  });

  await repository.updateGoogleCalendarConfig("mentor-1", {
    googleCalendarConnected: true,
    googleCalendarToken: "token",
  });
  const availability = await repository.findWithCalendarToken("mentor-1");

  assert.deepEqual(calls[0], [
    "update",
    { mentor: "mentor-1" },
    {
      $set: {
        googleCalendarConnected: true,
        googleCalendarToken: "token",
      },
    },
    { new: true, upsert: true, runValidators: true },
  ]);
  assert.deepEqual(calls[1], ["find", { mentor: "mentor-1" }]);
  assert.deepEqual(calls[2], ["select", "+googleCalendarToken"]);
  assert.deepEqual(availability, { googleCalendarToken: "token" });
});
