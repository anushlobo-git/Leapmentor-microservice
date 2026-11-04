const test = require("node:test");
const assert = require("node:assert/strict");

const validation = require("../../middleware/slotLockValidation");

const call = (middleware, req) => {
  let error;
  let called = false;
  middleware(req, {}, (value) => {
    error = value;
    called = true;
  });
  return { error, called };
};

test("validates slot lock IDs, date, and time", () => {
  const valid = {
    mentorId: "507f1f77bcf86cd799439011",
    date: "2026-01-31",
    startTime: "09:30",
    endTime: "10:30",
  };
  assert.equal(call(validation.validateSlot, { body: valid }).called, true);
  for (const body of [
    { ...valid, mentorId: "bad" },
    { ...valid, date: "31-01-2026" },
    { ...valid, startTime: "9:30" },
    { ...valid, endTime: "10:30:00" },
  ]) {
    assert.equal(call(validation.validateSlot, { body }).error.code, "INVALID_SLOT_LOCK");
  }
});

test("validates optional mentor for release-all and required mentor route parameter", () => {
  assert.equal(call(validation.validateUnlockAll, { body: {} }).called, true);
  assert.equal(
    call(validation.validateUnlockAll, {
      body: { mentorId: "507f1f77bcf86cd799439011" },
    }).called,
    true,
  );
  assert.equal(
    call(validation.validateUnlockAll, { body: { mentorId: "invalid" } }).error.code,
    "INVALID_SLOT_LOCK",
  );
  assert.equal(
    call(validation.validateMentorParam, {
      params: { mentorId: "507f1f77bcf86cd799439011" },
    }).called,
    true,
  );
  assert.equal(
    call(validation.validateMentorParam, { params: { mentorId: "bad" } }).error.code,
    "INVALID_SLOT_LOCK",
  );
});
