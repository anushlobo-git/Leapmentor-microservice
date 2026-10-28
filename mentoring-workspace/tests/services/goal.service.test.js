const test = require("node:test");
const assert = require("node:assert/strict");

const createGoalService = require("../../services/goal.service");

const REQUEST_ID = "507f1f77bcf86cd799439011";
const GOAL_ID = "507f1f77bcf86cd799439012";
const MILESTONE_ID = "507f1f77bcf86cd799439013";

const createHarness = (overrides = {}) => {
  const published = [];
  const state = {
    request: {
      _id: REQUEST_ID,
      mentor: "mentor-1",
      mentee: "mentee-1",
      status: "ongoing",
    },
    goal: null,
    milestone: null,
    lastMilestone: null,
    milestones: [],
    created: {},
    saved: [],
    deletedMilestoneId: null,
    ...overrides.state,
  };

  const connectRequestRepository = {
    findById: async () => state.request,
    ...overrides.connectRequestRepository,
  };
  const goalRepository = {
    findOneByConnectRequestLean: async () => state.goal,
    create: async (data) => {
      state.created.goal = data;
      return { _id: GOAL_ID, status: "active", ...data };
    },
    findById: async () => state.goal,
    save: async (goal) => {
      state.saved.push(goal);
      return goal;
    },
    ...overrides.goalRepository,
  };
  const milestoneRepository = {
    findAllByGoalSorted: async () => state.milestones,
    findLastMilestone: async () => state.lastMilestone,
    create: async (data) => {
      state.created.milestone = data;
      return { _id: MILESTONE_ID, isCompleted: false, ...data };
    },
    findById: async () => state.milestone,
    save: async (milestone) => {
      state.saved.push(milestone);
      return milestone;
    },
    deleteById: async (id) => {
      state.deletedMilestoneId = id;
    },
    ...overrides.milestoneRepository,
  };
  const realtimePublisher = overrides.realtimePublisher || {
    publishToRoom: (roomId, event, payload) =>
      published.push({ roomId, event, payload }),
  };

  const service = createGoalService({
    connectRequestRepository,
    goalRepository,
    milestoneRepository,
    realtimePublisher,
  });
  return { service, state, published };
};

const existingGoal = () => ({
  _id: GOAL_ID,
  connectRequest: REQUEST_ID,
  mentor: "mentor-1",
  mentee: "mentee-1",
  title: "Learn Node",
  description: "",
  status: "active",
});

const existingMilestone = () => ({
  _id: MILESTONE_ID,
  goal: GOAL_ID,
  connectRequest: REQUEST_ID,
  title: "Read docs",
  description: "",
  isCompleted: false,
  order: 0,
});

// ── createGoal ───────────────────────────────────────────────────────────────

test("createGoal stores a trimmed goal for a participant and publishes goal_created", async () => {
  const { service, state, published } = createHarness();
  const goal = await service.createGoal({
    connectRequestId: REQUEST_ID,
    title: "  Ship the API  ",
    description: " plan ",
    startDate: "2099-01-01",
    userId: "mentee-1",
  });

  assert.equal(goal.title, "Ship the API");
  assert.equal(goal.description, "plan");
  assert.equal(state.created.goal.mentor, "mentor-1");
  assert.equal(state.created.goal.mentee, "mentee-1");
  assert.equal(state.created.goal.createdBy, "mentee-1");
  assert.equal(state.created.goal.endDate, null);
  assert.equal(published.length, 1);
  assert.equal(published[0].roomId, REQUEST_ID);
  assert.equal(published[0].event, "goal_created");
  assert.equal(published[0].payload.goal.title, "Ship the API");
});

test("createGoal rejects missing input, missing sessions, non-ongoing sessions and outsiders", async () => {
  const { service } = createHarness();
  await assert.rejects(service.createGoal({ title: "x", userId: "mentee-1" }), {
    statusCode: 400,
  });
  await assert.rejects(
    service.createGoal({
      connectRequestId: REQUEST_ID,
      title: "  ",
      userId: "mentee-1",
    }),
    { statusCode: 400 },
  );
  await assert.rejects(
    service.createGoal({
      connectRequestId: REQUEST_ID,
      title: "x",
      userId: "outsider",
    }),
    { statusCode: 403, code: "NOT_PARTICIPANT" },
  );

  const missing = createHarness({ state: { request: null } });
  await assert.rejects(
    missing.service.createGoal({
      connectRequestId: REQUEST_ID,
      title: "x",
      userId: "mentee-1",
    }),
    { statusCode: 404, code: "SESSION_NOT_FOUND" },
  );

  const completed = createHarness({
    state: {
      request: { mentor: "mentor-1", mentee: "mentee-1", status: "completed" },
    },
  });
  await assert.rejects(
    completed.service.createGoal({
      connectRequestId: REQUEST_ID,
      title: "x",
      userId: "mentee-1",
    }),
    { statusCode: 400, code: "SESSION_NOT_ONGOING" },
  );
});

test("createGoal returns 409 when a goal already exists, including a duplicate-key race", async () => {
  const existing = createHarness({ state: { goal: existingGoal() } });
  await assert.rejects(
    existing.service.createGoal({
      connectRequestId: REQUEST_ID,
      title: "x",
      userId: "mentee-1",
    }),
    { statusCode: 409, code: "GOAL_EXISTS" },
  );

  const race = createHarness({
    goalRepository: {
      create: async () => {
        throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
      },
    },
  });
  await assert.rejects(
    race.service.createGoal({
      connectRequestId: REQUEST_ID,
      title: "x",
      userId: "mentee-1",
    }),
    { statusCode: 409, code: "GOAL_EXISTS" },
  );
});

test("createGoal still succeeds when the realtime publisher throws or is absent", async () => {
  const throwing = createHarness({
    realtimePublisher: {
      publishToRoom: () => {
        throw new Error("socket down");
      },
    },
  });
  const goal = await throwing.service.createGoal({
    connectRequestId: REQUEST_ID,
    title: "x",
    userId: "mentor-1",
  });
  assert.equal(goal.title, "x");

  const service = createGoalService({
    connectRequestRepository: {
      findById: async () => ({
        mentor: "mentor-1",
        mentee: "mentee-1",
        status: "ongoing",
      }),
    },
    goalRepository: {
      findOneByConnectRequestLean: async () => null,
      create: async (data) => ({ _id: GOAL_ID, ...data }),
    },
    milestoneRepository: {},
  });
  assert.equal(
    (
      await service.createGoal({
        connectRequestId: REQUEST_ID,
        title: "y",
        userId: "mentor-1",
      })
    ).title,
    "y",
  );
});

test("createGoal does not publish when persistence fails", async () => {
  const { service, published } = createHarness({
    goalRepository: {
      create: async () => {
        throw new Error("db down");
      },
    },
  });
  await assert.rejects(
    service.createGoal({
      connectRequestId: REQUEST_ID,
      title: "x",
      userId: "mentor-1",
    }),
    /db down/,
  );
  assert.equal(published.length, 0);
});

// ── getGoalByConnection ──────────────────────────────────────────────────────

test("getGoalByConnection returns the goal with ordered milestones for a participant", async () => {
  const { service } = createHarness({
    state: { goal: existingGoal(), milestones: [existingMilestone()] },
  });
  const result = await service.getGoalByConnection(REQUEST_ID, "mentor-1");
  assert.equal(result.goal.title, "Learn Node");
  assert.equal(result.milestones.length, 1);
  assert.equal(result.milestones[0].title, "Read docs");
});

test("getGoalByConnection returns an empty result when no goal exists and rejects outsiders", async () => {
  const { service } = createHarness();
  assert.deepEqual(await service.getGoalByConnection(REQUEST_ID, "mentee-1"), {
    goal: null,
    milestones: [],
  });
  await assert.rejects(service.getGoalByConnection(REQUEST_ID, "outsider"), {
    statusCode: 403,
    code: "NOT_PARTICIPANT",
  });

  const missing = createHarness({ state: { request: null } });
  await assert.rejects(
    missing.service.getGoalByConnection(REQUEST_ID, "mentee-1"),
    { statusCode: 404, code: "SESSION_NOT_FOUND" },
  );
});

// ── updateGoal ───────────────────────────────────────────────────────────────

test("updateGoal applies trimmed changes, saves, and publishes goal_updated", async () => {
  const { service, state, published } = createHarness({
    state: { goal: existingGoal() },
  });
  const dto = await service.updateGoal({
    goalId: GOAL_ID,
    title: "  New title ",
    description: " d ",
    endDate: "2099-12-31",
    status: "completed",
    userId: "mentee-1",
  });

  assert.equal(dto.title, "New title");
  assert.equal(dto.description, "d");
  assert.equal(dto.status, "completed");
  assert.equal(state.saved.length, 1);
  assert.equal(published[0].event, "goal_updated");
  assert.equal(published[0].roomId, REQUEST_ID);
});

test("updateGoal rejects unknown goals, outsiders, empty titles and invalid statuses", async () => {
  const missing = createHarness();
  await assert.rejects(
    missing.service.updateGoal({ goalId: GOAL_ID, userId: "mentee-1" }),
    { statusCode: 404, code: "GOAL_NOT_FOUND" },
  );

  const noSession = createHarness({
    state: { goal: existingGoal(), request: null },
  });
  await assert.rejects(
    noSession.service.updateGoal({ goalId: GOAL_ID, userId: "mentee-1" }),
    { statusCode: 404, code: "SESSION_NOT_FOUND" },
  );

  const { service, state, published } = createHarness({
    state: { goal: existingGoal() },
  });
  await assert.rejects(
    service.updateGoal({ goalId: GOAL_ID, userId: "outsider" }),
    { statusCode: 403 },
  );
  await assert.rejects(
    service.updateGoal({ goalId: GOAL_ID, title: "  ", userId: "mentee-1" }),
    { statusCode: 400 },
  );
  await assert.rejects(
    service.updateGoal({
      goalId: GOAL_ID,
      status: "paused",
      userId: "mentee-1",
    }),
    { statusCode: 400, code: "INVALID_STATUS" },
  );
  assert.equal(state.saved.length, 0);
  assert.equal(published.length, 0);
});

// ── milestones ───────────────────────────────────────────────────────────────

test("createMilestone appends after the last order and publishes milestone_added", async () => {
  const { service, state, published } = createHarness({
    state: { goal: existingGoal(), lastMilestone: { order: 4 } },
  });
  const dto = await service.createMilestone({
    goalId: GOAL_ID,
    title: " First step ",
    dueDate: "2099-02-02",
    userId: "mentor-1",
  });

  assert.equal(dto.title, "First step");
  assert.equal(state.created.milestone.order, 5);
  assert.equal(state.created.milestone.connectRequest, REQUEST_ID);
  assert.equal(published[0].event, "milestone_added");
  assert.equal(published[0].payload.milestone.title, "First step");
});

test("createMilestone starts at order 0 and rejects missing goals, outsiders and blank titles", async () => {
  const first = createHarness({ state: { goal: existingGoal() } });
  await first.service.createMilestone({
    goalId: GOAL_ID,
    title: "a",
    userId: "mentee-1",
  });
  assert.equal(first.state.created.milestone.order, 0);

  await assert.rejects(
    createHarness().service.createMilestone({
      goalId: GOAL_ID,
      title: "a",
      userId: "mentee-1",
    }),
    { statusCode: 404, code: "GOAL_NOT_FOUND" },
  );
  await assert.rejects(
    first.service.createMilestone({
      goalId: GOAL_ID,
      title: "a",
      userId: "outsider",
    }),
    { statusCode: 403 },
  );
  await assert.rejects(
    first.service.createMilestone({
      goalId: GOAL_ID,
      title: " ",
      userId: "mentee-1",
    }),
    { statusCode: 400 },
  );
});

test("updateMilestone toggles completion with actor and timestamp, then publishes milestone_updated", async () => {
  const { service, published } = createHarness({
    state: { milestone: existingMilestone() },
  });
  const done = await service.updateMilestone({
    milestoneId: MILESTONE_ID,
    isCompleted: true,
    userId: "mentee-1",
  });
  assert.equal(done.isCompleted, true);
  assert.equal(done.completedBy, "mentee-1");
  assert.ok(done.completedAt instanceof Date);

  const undone = await service.updateMilestone({
    milestoneId: MILESTONE_ID,
    isCompleted: false,
    title: " Renamed ",
    userId: "mentee-1",
  });
  assert.equal(undone.isCompleted, false);
  assert.equal(undone.completedAt, null);
  assert.equal(undone.completedBy, null);
  assert.equal(undone.title, "Renamed");
  assert.deepEqual(
    published.map((entry) => entry.event),
    ["milestone_updated", "milestone_updated"],
  );
});

test("updateMilestone rejects unknown milestones, outsiders and blank titles", async () => {
  await assert.rejects(
    createHarness().service.updateMilestone({
      milestoneId: MILESTONE_ID,
      userId: "mentee-1",
    }),
    { statusCode: 404, code: "MILESTONE_NOT_FOUND" },
  );
  const { service } = createHarness({
    state: { milestone: existingMilestone() },
  });
  await assert.rejects(
    service.updateMilestone({ milestoneId: MILESTONE_ID, userId: "outsider" }),
    { statusCode: 403 },
  );
  await assert.rejects(
    service.updateMilestone({
      milestoneId: MILESTONE_ID,
      title: " ",
      userId: "mentee-1",
    }),
    { statusCode: 400 },
  );
});

test("deleteMilestone removes the milestone and publishes milestone_deleted with its id", async () => {
  const { service, state, published } = createHarness({
    state: { milestone: existingMilestone() },
  });
  assert.equal(
    await service.deleteMilestone(MILESTONE_ID, "mentor-1"),
    MILESTONE_ID,
  );
  assert.equal(state.deletedMilestoneId, MILESTONE_ID);
  assert.deepEqual(published[0], {
    roomId: REQUEST_ID,
    event: "milestone_deleted",
    payload: { milestoneId: MILESTONE_ID },
  });
});

test("deleteMilestone rejects unknown milestones and outsiders without deleting", async () => {
  await assert.rejects(
    createHarness().service.deleteMilestone(MILESTONE_ID, "mentor-1"),
    { statusCode: 404, code: "MILESTONE_NOT_FOUND" },
  );
  const { service, state } = createHarness({
    state: { milestone: existingMilestone() },
  });
  await assert.rejects(service.deleteMilestone(MILESTONE_ID, "outsider"), {
    statusCode: 403,
  });
  assert.equal(state.deletedMilestoneId, null);
});
