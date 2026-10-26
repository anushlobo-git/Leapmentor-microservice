const test = require("node:test");
const assert = require("node:assert/strict");

const createAvailabilityService = require("../../services/availability.service");

const createFakes = () => {
  const records = [];
  const repository = {
    findAvailabilityByMentor: async (mentorId) =>
      records.find((record) => record.mentor === mentorId) || null,
    createAvailability: async (data) => {
      const record = {
        _id: "availability-1",
        mentor: data.mentorId,
        timezone: data.timezone || "Asia/Kolkata",
        sessionDurations: data.sessionDurations || [30, 60],
        specificDates: data.specificDates || [],
        weeklyHours: data.weeklyHours || [],
      };
      records.push(record);
      return record;
    },
    updateAvailability: async (mentorId, updates) => {
      const record = records.find((candidate) => candidate.mentor === mentorId);
      if (!record) {
        const created = { _id: "availability-upsert", mentor: mentorId, ...updates };
        records.push(created);
        return created;
      }
      Object.assign(record, updates);
      return record;
    },
    deleteAvailability: async (mentorId) => {
      const index = records.findIndex((record) => record.mentor === mentorId);
      if (index >= 0) records.splice(index, 1);
    },
  };
  return {
    records,
    availabilityRepository: repository,
    workspaceClient: {
      getSlotBlockers: async () => ({
        bookedSlots: [{ date: "2099-01-02", startTime: "09:00", endTime: "10:00" }],
        lockedSlots: [{ date: "2099-01-02", startTime: "10:00", endTime: "11:00" }],
      }),
    },
    toAvailabilityDTO: (value) => ({ dto: true, ...value }),
  };
};

const mentor = { _id: "mentor-1", roles: ["mentor"] };

test("returns a safe default availability for a mentor without a record", async () => {
  const service = createAvailabilityService(createFakes());
  const result = await service.getMyAvailability("mentor-1", { user: mentor });
  assert.deepEqual(result, {
    mentor: "mentor-1",
    timezone: "Asia/Kolkata",
    sessionDurations: [30, 60],
    weeklyHours: [],
    specificDates: [],
    googleCalendarConnected: false,
    isNew: true,
  });
});

test("requires the mentor role for private availability operations", async () => {
  const service = createAvailabilityService(createFakes());
  await assert.rejects(
    () => service.getMyAvailability("user-1", { user: { roles: ["mentee"] } }),
    { statusCode: 403, code: "ROLE_REQUIRED" },
  );
});

test("creates, updates, and deletes a mentor availability record", async () => {
  const fakes = createFakes();
  const service = createAvailabilityService(fakes);
  const body = {
    timezone: "UTC",
    sessionDurations: [30, 60],
    weeklyHours: [],
    specificDates: [],
  };

  const created = await service.createAvailability("mentor-1", body, { user: mentor });
  assert.equal(created.dto, true);
  await assert.rejects(
    () => service.createAvailability("mentor-1", body, { user: mentor }),
    { statusCode: 409, code: "AVAILABILITY_EXISTS" },
  );
  const updated = await service.updateAvailability(
    "mentor-1",
    { timezone: "Europe/London", ignored: true },
    { user: mentor },
  );
  assert.equal(updated.timezone, "Europe/London");
  await service.deleteAvailability("mentor-1", { user: mentor });
  assert.equal(fakes.records.length, 0);
});

test("returns public availability without exposing weekly schedule details", async () => {
  const fakes = createFakes();
  fakes.records.push({
    mentor: "mentor-1",
    timezone: "UTC",
    sessionDurations: [30],
    weeklyHours: [{ day: "Monday", isAvailable: true, slots: [] }],
    specificDates: [{ date: "2099-01-02", slots: [] }],
  });
  const service = createAvailabilityService(fakes);
  assert.deepEqual(await service.getMentorAvailability("mentor-1"), {
    timezone: "UTC",
    sessionDurations: [30],
    specificDates: [{ date: "2099-01-02", slots: [] }],
  });
});

test("uses Workspace blockers when generating available slots", async () => {
  const fakes = createFakes();
  fakes.records.push({
    mentor: "mentor-1",
    timezone: "UTC",
    sessionDurations: [30, 60],
    specificDates: [{
      date: "2099-01-02",
      slots: [{ startTime: "09:00", endTime: "12:00" }],
    }],
    weeklyHours: [],
  });
  let blockerCall;
  fakes.workspaceClient.getSlotBlockers = async (...args) => {
    blockerCall = args;
    return { bookedSlots: [], lockedSlots: [] };
  };
  const service = createAvailabilityService(fakes);
  const result = await service.getAvailableSlots("mentor-1", 60, "mentee-1", {
    correlationId: "corr-slots",
  });

  assert.deepEqual(blockerCall, ["mentor-1", "mentee-1", "corr-slots"]);
  assert.equal(result.slots[0].slots.length, 3);
});

test("rejects unsupported slot durations", async () => {
  const service = createAvailabilityService(createFakes());
  await assert.rejects(
    () => service.getAvailableSlots("mentor-1", 15, "mentee-1"),
    { statusCode: 400, code: "INVALID_DURATION" },
  );
});
