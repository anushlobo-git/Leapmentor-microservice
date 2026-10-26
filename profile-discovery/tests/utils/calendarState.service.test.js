const test = require("node:test");
const assert = require("node:assert/strict");

const createCalendarStateService = require("../../utils/calendarState.service");

test("signs and verifies a short-lived Google Calendar state", () => {
  const stateService = createCalendarStateService({
    secret: "test-secret",
    ttlSeconds: 60,
  });
  const state = stateService.create("user-1");

  assert.equal(stateService.verify(state).userId, "user-1");
});

test("rejects tampered Google Calendar state", () => {
  const stateService = createCalendarStateService({ secret: "test-secret" });
  const state = stateService.create("user-1");

  assert.throws(() => stateService.verify(`${state}tampered`));
});
