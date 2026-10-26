const test = require("node:test");
const assert = require("node:assert/strict");

const validations = require("../../middleware/availabilityValidation");

test("accepts a valid availability update", () => {
  let called = false;
  validations.updateAvailabilityValidation(
    {
      body: {
        timezone: "UTC",
        sessionDurations: [30, 60],
        weeklyHours: [{
          day: "Monday",
          isAvailable: true,
          slots: [{ startTime: "09:00", endTime: "11:00" }],
        }],
        specificDates: [],
      },
    },
    {},
    () => {
      called = true;
    },
  );
  assert.equal(called, true);
});

test("rejects invalid timezone, time ranges, and duration values", () => {
  let timezoneError;
  validations.updateAvailabilityValidation(
    { body: { timezone: "Not/A_Timezone" } },
    {},
    (error) => {
      timezoneError = error;
    },
  );
  assert.equal(timezoneError.code, "INVALID_AVAILABILITY");

  let durationError;
  validations.updateAvailabilityValidation(
    { body: { sessionDurations: [15] } },
    {},
    (error) => {
      durationError = error;
    },
  );
  assert.equal(durationError.code, "INVALID_AVAILABILITY");

  let timeError;
  validations.updateAvailabilityValidation(
    {
      body: {
        weeklyHours: [{
          day: "Monday",
          isAvailable: true,
          slots: [{ startTime: "11:00", endTime: "10:00" }],
        }],
      },
    },
    {},
    (error) => {
      timeError = error;
    },
  );
  assert.equal(timeError.code, "INVALID_AVAILABILITY");
});
