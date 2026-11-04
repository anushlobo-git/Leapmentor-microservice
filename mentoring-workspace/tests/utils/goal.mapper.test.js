const test = require("node:test");
const assert = require("node:assert/strict");

const { toGoalDTO, toMilestoneDTO } = require("../../utils/goal.mapper");

const objectId = (value) => ({ toString: () => value });

test("toGoalDTO serialises ObjectIds to strings and exposes only goal fields", () => {
  const dto = toGoalDTO({
    _id: objectId("goal-1"),
    connectRequest: objectId("request-1"),
    mentor: objectId("mentor-1"),
    mentee: objectId("mentee-1"),
    createdBy: objectId("mentee-1"),
    title: "Learn",
    description: "d",
    status: "active",
    startDate: null,
    endDate: null,
    internalSecret: "hidden",
    __v: 3,
  });

  assert.equal(dto._id, "goal-1");
  assert.equal(dto.connectRequest, "request-1");
  assert.equal(dto.createdBy, "mentee-1");
  assert.equal(dto.title, "Learn");
  assert.equal("internalSecret" in dto, false);
  assert.equal("__v" in dto, false);
});

test("toMilestoneDTO handles lean objects with null completion fields", () => {
  const dto = toMilestoneDTO({
    _id: "m-1",
    goal: "goal-1",
    connectRequest: "request-1",
    title: "Step",
    isCompleted: false,
    completedAt: null,
    completedBy: null,
    order: 2,
  });

  assert.equal(dto._id, "m-1");
  assert.equal(dto.goal, "goal-1");
  assert.equal(dto.completedBy, null);
  assert.equal(dto.order, 2);
});

test("goal and milestone DTOs retain undefined identifiers and nullable values", () => {
  const goal = toGoalDTO({});
  assert.equal(goal._id, undefined);
  assert.equal(goal.connectRequest, undefined);
  assert.equal(goal.mentor, undefined);
  assert.equal(goal.mentee, undefined);
  assert.equal(goal.createdBy, undefined);

  const milestone = toMilestoneDTO({
    _id: null,
    goal: null,
    connectRequest: null,
    completedBy: null,
  });
  assert.equal(milestone._id, null);
  assert.equal(milestone.goal, null);
  assert.equal(milestone.connectRequest, null);
  assert.equal(milestone.completedBy, null);
});
