const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/goal.controller");

test("goal controller forwards errors from every goal and milestone operation", async () => {
  const methods = [
    ["createGoal", "createGoal"],
    ["getGoal", "getGoalByConnection"],
    ["updateGoal", "updateGoal"],
    ["createMilestone", "createMilestone"],
    ["updateMilestone", "updateMilestone"],
    ["deleteMilestone", "deleteMilestone"],
  ];
  const failure = new Error("goal operation failed");
  const goalService = Object.fromEntries(
    methods.map(([, serviceMethod]) => [
      serviceMethod,
      async () => { throw failure; },
    ]),
  );
  const controller = createController({ goalService });
  const req = {
    body: {},
    params: {},
    user: { _id: "user-1" },
  };
  for (const [handler] of methods) {
    const res = {
      status() { return this; },
      json() { return this; },
    };
    let error;
    await controller[handler](req, res, (value) => { error = value; });
    assert.equal(error, failure, handler);
  }
});
