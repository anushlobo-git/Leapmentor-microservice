const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/internalAvailability.controller");

test("returns normalized booked and locked slot blockers", async () => {
  const controller = createController({
    availabilityBlockerRepository: {
      findBookedRequestsByMentor: async () => [
        {
          selectedSlots: [
            { date: "2099-01-02", startTime: "09:00", endTime: "10:00", extra: "ignored" },
          ],
        },
      ],
      findActiveLocksByMentor: async () => [
        { date: "2099-01-02", startTime: "10:00", endTime: "11:00", extra: "ignored" },
      ],
    },
  });
  const response = {};
  const res = {
    status: (code) => {
      response.statusCode = code;
      return res;
    },
    json: (body) => {
      response.body = body;
      return res;
    },
  };

  await controller.getBlockers(
    { params: { mentorId: "mentor-1" }, query: { excludeUserId: "mentee-1" } },
    res,
    assert.fail,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data, {
    bookedSlots: [{ date: "2099-01-02", startTime: "09:00", endTime: "10:00" }],
    lockedSlots: [{ date: "2099-01-02", startTime: "10:00", endTime: "11:00" }],
  });
});
