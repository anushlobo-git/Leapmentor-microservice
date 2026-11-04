const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/internalAvailability.controller");

test("returns normalized booked and locked slot blockers", async () => {
  const controller = createController({
    availabilityBlockerRepository: {
      findBookedRequestsByMentor: async () => [
        {
          selectedSlots: [
            {
              date: "2099-01-02",
              startTime: "09:00",
              endTime: "10:00",
              extra: "ignored",
            },
          ],
        },
      ],
      findActiveLocksByMentor: async () => [
        {
          date: "2099-01-02",
          startTime: "10:00",
          endTime: "11:00",
          extra: "ignored",
        },
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

test("reschedule blocker mode returns only original request slots", async () => {
  let requestLookup;
  let globalLookupCalled = false;
  const controller = createController({
    availabilityBlockerRepository: {
      findRequestSlotsById: async (...args) => {
        requestLookup = args;
        return {
          selectedSlots: [
            {
              date: "2099-01-02",
              startTime: "09:00",
              endTime: "10:00",
              status: "booked",
            },
            {
              date: "2099-01-03",
              startTime: "09:00",
              endTime: "10:00",
              status: "cancelled",
            },
          ],
          additionalSlots: [
            {
              date: "2099-01-04",
              startTime: "09:00",
              endTime: "10:00",
              status: "cancelled",
              paymentStatus: "pending",
            },
            {
              date: "2099-01-05",
              startTime: "09:00",
              endTime: "10:00",
              paymentStatus: "paid",
            },
          ],
        };
      },
      findBookedRequestsByMentor: async () => {
        globalLookupCalled = true;
        return [];
      },
      findActiveLocksByMentor: async () => {
        globalLookupCalled = true;
        return [];
      },
    },
  });
  const response = {};
  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    json(body) {
      response.body = body;
      return this;
    },
  };

  await controller.getBlockers(
    {
      params: { mentorId: "mentor-1" },
      query: { requestId: "request-1", excludeUserId: "mentee-1" },
    },
    res,
    assert.fail,
  );

  assert.deepEqual(requestLookup, ["request-1", "mentor-1"]);
  assert.equal(globalLookupCalled, false);
  assert.deepEqual(response.body.data, {
    bookedSlots: [
      { date: "2099-01-02", startTime: "09:00", endTime: "10:00" },
      { date: "2099-01-05", startTime: "09:00", endTime: "10:00" },
    ],
    lockedSlots: [],
  });
});

test("supports legacy request slots and forwards blocker repository failures", async () => {
  const controller = createController({
    availabilityBlockerRepository: {
      findRequestSlotsById: async () => ({
        selectedSlot: {
          date: "2099-01-02",
          startTime: "09:00",
          endTime: "10:00",
          status: "booked",
        },
        additionalSlots: [],
      }),
    },
  });
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await controller.getBlockers(
    { params: { mentorId: "mentor-1" }, query: { requestId: "request-1" } },
    res,
    assert.fail,
  );
  assert.deepEqual(res.body.data.bookedSlots, [{
    date: "2099-01-02",
    startTime: "09:00",
    endTime: "10:00",
  }]);

  const expected = new Error("blockers unavailable");
  let received;
  await createController({
    availabilityBlockerRepository: {
      findBookedRequestsByMentor: async () => { throw expected; },
      findActiveLocksByMentor: async () => [],
    },
  }).getBlockers(
    { params: { mentorId: "mentor-1" }, query: {} },
    res,
    (error) => { received = error; },
  );
  assert.equal(received, expected);
});
