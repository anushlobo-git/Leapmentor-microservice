const test = require("node:test");
const assert = require("node:assert/strict");

const validation = require("../../middleware/connectRequestValidation");

const call = (middleware, req) => {
  let error;
  let called = false;
  middleware(req, {}, (value) => {
    error = value;
    called = true;
  });
  return { error, called };
};

const id = "507f1f77bcf86cd799439011";

test("validates request route IDs and create request fields", () => {
  assert.equal(call(validation.validateId, { params: { id } }).called, true);
  assert.equal(call(validation.validateId, { params: { id: "bad" } }).error.code, "INVALID_CONNECT_REQUEST");
  assert.equal(call(validation.validateCreate, {
    body: { mentorId: id, selectedSlots: [{}] },
  }).called, true);
  for (const body of [
    {},
    { mentorId: "bad", selectedSlots: [{}] },
    { mentorId: id, selectedSlots: [] },
    { mentorId: id, selectedSlots: Array(6).fill({}) },
  ]) {
    assert.equal(call(validation.validateCreate, { body }).error.code, "INVALID_CONNECT_REQUEST");
  }
});

test("validates response and referral IDs and allowed status", () => {
  assert.equal(call(validation.validateResponse, {
    params: { id },
    body: { status: "accepted" },
  }).called, true);
  for (const req of [
    { params: { id: "bad" }, body: { status: "accepted" } },
    { params: { id }, body: { status: "pending" } },
  ]) {
    assert.equal(call(validation.validateResponse, req).error.code, "INVALID_CONNECT_REQUEST");
  }
  assert.equal(call(validation.validateRefer, {
    params: { id },
    body: { referToMentorId: id },
  }).called, true);
  for (const req of [
    { params: { id: "bad" }, body: { referToMentorId: id } },
    { params: { id }, body: { referToMentorId: "bad" } },
  ]) {
    assert.equal(call(validation.validateRefer, req).error.code, "INVALID_CONNECT_REQUEST");
  }
});
