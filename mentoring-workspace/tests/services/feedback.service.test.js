const test = require("node:test");
const assert = require("node:assert/strict");

const createFeedbackService = require("../../services/feedback.service");

const REQUEST_ID = "507f1f77bcf86cd799439011";
const MENTOR = "507f1f77bcf86cd799439031";
const MENTEE = "507f1f77bcf86cd799439032";

const completed = {
  _id: REQUEST_ID,
  mentor: MENTOR,
  mentee: MENTEE,
  status: "completed",
  selectedSlots: [{ menteeMarked: true, mentorMarked: false }],
};

const build = (overrides = {}) => {
  const calls = { created: [], ratings: [], warnings: [], queries: [] };
  const deps = {
    connectRequestRepository: { findById: async () => completed },
    feedbackRepository: {
      findOne: async (query) => {
        calls.queries.push(query);
        return null;
      },
      create: async (data) => {
        calls.created.push(data);
        return { _id: "f1", createdAt: "t", updatedAt: "t", ...data };
      },
      findAllByTargetUser: async () => [
        { rating: 5 },
        { rating: 4 },
        { rating: 4 },
      ],
      findAllByConnectRequest: async () => [],
    },
    identityClient: {
      getUserSummaryMap: async () =>
        new Map([
          [MENTEE, { name: "Ravi", email: "r@x.test" }],
          [MENTOR, { name: "Maya", email: "m@x.test" }],
        ]),
    },
    mentorRatingClient: {
      updateAverageRating: async (...args) => {
        calls.ratings.push(args);
      },
    },
    logger: { warn: (message, meta) => calls.warnings.push({ message, meta }) },
    ...overrides,
  };
  return { service: createFeedbackService(deps), calls };
};

const rejects = async (promise, status, code) =>
  assert.rejects(promise, (error) => {
    assert.equal(error.statusCode, status);
    assert.equal(error.code, code);
    return true;
  });

const submit = (service, overrides = {}) =>
  service.createFeedback({
    connectRequestId: REQUEST_ID,
    rating: 5,
    comment: "  great  ",
    userId: MENTEE,
    correlationId: "corr-1",
    ...overrides,
  });

test("mentee feedback is saved for the mentor, decorated, and updates the mentor average", async () => {
  const { service, calls } = build();
  const dto = await submit(service);

  assert.deepEqual(calls.created[0], {
    connectRequest: REQUEST_ID,
    from: MENTEE,
    to: MENTOR,
    fromRole: "mentee",
    rating: 5,
    comment: "great",
  });
  assert.equal(dto.from.name, "Ravi");
  assert.equal(dto.to.id, MENTOR);
  assert.deepEqual(calls.ratings, [[MENTOR, 4.3, "corr-1"]]);
});

test("mentor feedback targets the mentee and does not touch the mentor average", async () => {
  const { service, calls } = build();
  await submit(service, { userId: MENTOR });
  assert.equal(calls.created[0].to, MENTEE);
  assert.equal(calls.created[0].fromRole, "mentor");
  assert.equal(calls.ratings.length, 0);
});

test("input and access rules", async () => {
  const { service } = build();
  await rejects(
    submit(service, { connectRequestId: "" }),
    400,
    "CONNECT_REQUEST_REQUIRED",
  );
  await rejects(submit(service, { rating: 0 }), 400, "INVALID_RATING");
  await rejects(submit(service, { rating: 6 }), 400, "INVALID_RATING");
  await rejects(submit(service, { rating: 3.5 }), 400, "INVALID_RATING");
  await rejects(submit(service, { rating: "5" }), 400, "INVALID_RATING");
  await rejects(
    submit(service, { userId: "stranger" }),
    403,
    "NOT_SESSION_PARTICIPANT",
  );

  const missing = build({
    connectRequestRepository: { findById: async () => null },
  });
  await rejects(submit(missing.service), 404, "SESSION_NOT_FOUND");

  const ongoing = build({
    connectRequestRepository: {
      findById: async () => ({ ...completed, status: "ongoing" }),
    },
  });
  await rejects(submit(ongoing.service), 400, "FEEDBACK_SESSION_NOT_COMPLETED");
});

test("slot feedback needs the caller's own mark and is deduplicated per slot", async () => {
  const ongoing = {
    ...completed,
    status: "ongoing",
  };
  const { service, calls } = build({
    connectRequestRepository: { findById: async () => ongoing },
  });

  const dto = await submit(service, { slotIndex: 0 });
  assert.equal(calls.created[0].slotIndex, 0);
  assert.deepEqual(calls.queries[0], {
    connectRequest: REQUEST_ID,
    from: MENTEE,
    slotIndex: 0,
  });
  assert.ok(dto);

  await rejects(
    submit(service, { userId: MENTOR, slotIndex: 0 }),
    400,
    "FEEDBACK_SESSION_NOT_COMPLETED",
  );
  await rejects(
    submit(service, { slotIndex: 3 }),
    400,
    "FEEDBACK_SESSION_NOT_COMPLETED",
  );
});

test("duplicates return 409, including a race lost on the unique index", async () => {
  const seen = build({
    feedbackRepository: {
      findOne: async () => ({ _id: "old" }),
      create: async () => {
        throw new Error("must not be called");
      },
    },
  });
  await rejects(submit(seen.service), 409, "FEEDBACK_EXISTS");

  const race = build({
    feedbackRepository: {
      findOne: async () => null,
      create: async () => {
        throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
      },
    },
  });
  await rejects(submit(race.service), 409, "FEEDBACK_EXISTS");

  const other = build({
    feedbackRepository: {
      findOne: async () => null,
      create: async () => {
        throw new Error("mongo down");
      },
    },
  });
  await assert.rejects(submit(other.service), /mongo down/);
});

test("a failed Profile rating sync or Identity lookup never fails the submission", async () => {
  const { service, calls } = build({
    mentorRatingClient: {
      updateAverageRating: async () => {
        throw new Error("profile down");
      },
    },
    identityClient: {
      getUserSummaryMap: async () => {
        throw new Error("identity down");
      },
    },
  });
  const dto = await submit(service);
  assert.equal(dto.from, MENTEE);
  assert.equal(dto.to, MENTOR);
  assert.equal(calls.warnings.length, 2);
  assert.match(calls.warnings[0].message, /rating sync failed/);
});

test("a missing rating client is logged and skipped", async () => {
  const { service, calls } = build({ mentorRatingClient: null });
  await submit(service);
  assert.match(calls.warnings[0].message, /not configured/);
});

test("getFeedback returns my feedback and, once completed, theirs", async () => {
  const mine = {
    _id: "f1",
    connectRequest: REQUEST_ID,
    from: MENTEE,
    to: MENTOR,
    fromRole: "mentee",
    rating: 5,
  };
  const theirs = {
    _id: "f2",
    connectRequest: REQUEST_ID,
    from: MENTOR,
    to: MENTEE,
    fromRole: "mentor",
    rating: 4,
  };
  const repo = { findAllByConnectRequest: async () => [theirs, mine] };

  const done = build({ feedbackRepository: repo });
  const result = await done.service.getFeedback(REQUEST_ID, MENTEE);
  assert.equal(result.myFeedback._id, "f1");
  assert.equal(result.myFeedback.from.name, "Ravi");
  assert.equal(result.theirFeedback._id, "f2");
  assert.equal(result.sessionStatus, "completed");

  const ongoing = build({
    feedbackRepository: repo,
    connectRequestRepository: {
      findById: async () => ({ ...completed, status: "ongoing" }),
    },
  });
  const hidden = await ongoing.service.getFeedback(REQUEST_ID, MENTEE);
  assert.equal(hidden.myFeedback._id, "f1");
  assert.equal(hidden.theirFeedback, null);
  assert.equal(hidden.sessionStatus, "ongoing");
});

test("getFeedback with nothing submitted returns nulls without calling Identity, and enforces access", async () => {
  let identityCalls = 0;
  const { service } = build({
    identityClient: {
      getUserSummaryMap: async () => {
        identityCalls += 1;
        return new Map();
      },
    },
  });
  const result = await service.getFeedback(REQUEST_ID, MENTOR);
  assert.deepEqual(result, {
    myFeedback: null,
    theirFeedback: null,
    sessionStatus: "completed",
  });
  assert.equal(identityCalls, 0);

  await rejects(
    service.getFeedback(REQUEST_ID, "stranger"),
    403,
    "NOT_SESSION_PARTICIPANT",
  );
  const missing = build({
    connectRequestRepository: { findById: async () => null },
  });
  await rejects(
    missing.service.getFeedback(REQUEST_ID, MENTOR),
    404,
    "SESSION_NOT_FOUND",
  );
});
