const test = require("node:test");
const assert = require("node:assert/strict");

const validation = require("../../middleware/sessionValidation");

const call = (middleware, req) => {
  let error;
  let called = false;
  middleware(req, {}, (value) => {
    error = value;
    called = true;
  });
  return { error, called };
};

test("validates request IDs and non-negative slot indices", () => {
  const validId = "507f1f77bcf86cd799439011";
  assert.equal(call(validation.requestId, { params: { connectRequestId: validId } }).called, true);
  assert.equal(call(validation.requestId, { params: {} }).error.code, "INVALID_SESSION_REQUEST");
  assert.equal(call(validation.slotIndex, { params: { slotIndex: "0" } }).called, true);
  for (const slotIndex of ["-1", "1.5", "abc", ""]) {
    assert.equal(
      call(validation.slotIndex, { params: { slotIndex } }).error.code,
      "INVALID_SESSION_REQUEST",
    );
  }
});

test("validates slot date and time formats and required meeting links", () => {
  const validBody = { date: "2026-01-31", startTime: "09:30", endTime: "10:30" };
  assert.equal(call(validation.slotBody, { body: validBody }).called, true);
  assert.equal(
    call(validation.slotBody, { body: { ...validBody, date: "31-01-2026" } }).error.code,
    "INVALID_SESSION_REQUEST",
  );
  assert.equal(
    call(validation.slotBody, { body: { ...validBody, startTime: "9:30" } }).error.code,
    "INVALID_SESSION_REQUEST",
  );
  assert.equal(call(validation.meetingLink, { body: { meetingLink: "https://example.com" } }).called, true);
  for (const body of [{}, { meetingLink: "" }, { meetingLink: 123 }]) {
    assert.equal(call(validation.meetingLink, { body }).error.code, "INVALID_SESSION_REQUEST");
  }
});
