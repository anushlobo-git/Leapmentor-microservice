const test = require("node:test");
const assert = require("node:assert/strict");

const validation = require("../../middleware/goalValidation");

const id = "507f1f77bcf86cd799439011";

const call = (handler, req) => {
  let error;
  let called = false;
  handler(req, {}, (value) => {
    error = value;
    called = true;
  });
  return { error, called, req };
};

test("validates goal and milestone IDs and normalizes optional request bodies", () => {
  for (const [handler, params] of [
    [validation.connectRequestIdParam, { connectRequestId: id }],
    [validation.goalIdParam, { goalId: id }],
    [validation.milestoneIdParam, { milestoneId: id }],
  ]) {
    assert.equal(call(handler, { params }).called, true);
  }
  for (const [handler, params] of [
    [validation.connectRequestIdParam, { connectRequestId: "bad" }],
    [validation.goalIdParam, { goalId: "bad" }],
    [validation.milestoneIdParam, { milestoneId: "bad" }],
  ]) {
    assert.equal(call(handler, { params }).error.code, "INVALID_GOAL_REQUEST");
  }
  for (const body of [undefined, null]) {
    const result = call(validation.validateUpdateMilestone, {
      params: { milestoneId: id },
      body,
    });
    assert.deepEqual(result.req.body, {});
    assert.equal(result.called, true);
  }
});

test("validates goal creation and optional strings and dates", () => {
  const valid = {
    connectRequestId: id,
    title: "Learn",
    description: "Details",
    startDate: "2026-01-01",
    endDate: "2026-02-01",
  };
  assert.equal(call(validation.validateCreateGoal, { body: valid }).called, true);
  assert.equal(call(validation.validateCreateGoal, {
    body: { ...valid, description: 12 },
  }).error.code, "INVALID_GOAL_REQUEST");
  assert.equal(call(validation.validateCreateGoal, {
    body: { ...valid, startDate: "bad" },
  }).error.code, "INVALID_GOAL_REQUEST");
  assert.equal(call(validation.validateCreateGoal, {
    body: { ...valid, endDate: 12 },
  }).error.code, "INVALID_GOAL_REQUEST");
  assert.equal(call(validation.validateCreateGoal, {
    body: { ...valid, title: " " },
  }).error.code, "INVALID_GOAL_REQUEST");
});

test("validates goal updates and milestone create/update fields", () => {
  assert.equal(call(validation.validateUpdateGoal, {
    params: { goalId: id },
    body: { status: "completed", title: "Updated", description: "", startDate: null, endDate: "" },
  }).called, true);
  for (const body of [
    { title: "" },
    { description: 1 },
    { status: "unknown" },
    { startDate: "bad" },
    { endDate: 42 },
  ]) {
    assert.equal(call(validation.validateUpdateGoal, {
      params: { goalId: id },
      body,
    }).error.code, "INVALID_GOAL_REQUEST");
  }

  assert.equal(call(validation.validateCreateMilestone, {
    params: { goalId: id },
    body: { title: "Milestone", description: null, dueDate: "2026-03-01" },
  }).called, true);
  assert.equal(call(validation.validateCreateMilestone, {
    params: { goalId: id },
    body: { title: "Milestone", description: false },
  }).error.code, "INVALID_GOAL_REQUEST");
  assert.equal(call(validation.validateCreateMilestone, {
    params: { goalId: id },
    body: { title: "Milestone", dueDate: "invalid" },
  }).error.code, "INVALID_GOAL_REQUEST");

  assert.equal(call(validation.validateUpdateMilestone, {
    params: { milestoneId: id },
    body: { isCompleted: true, description: "Done" },
  }).called, true);
  for (const body of [
    { title: " " },
    { description: 42 },
    { isCompleted: "yes" },
  ]) {
    assert.equal(call(validation.validateUpdateMilestone, {
      params: { milestoneId: id },
      body,
    }).error.code, "INVALID_GOAL_REQUEST");
  }
});
