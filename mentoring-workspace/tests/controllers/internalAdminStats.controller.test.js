const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/internalAdminStats.controller");

const response = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const invoke = async (handler, req) => {
  const res = response();
  let error;
  await handler(req, res, (value) => { error = value; });
  return { res, error };
};

test("filters admin engagement history to the exact mentee ID", async () => {
  let countFilter;
  let listFilter;
  const controller = createController({
    connectRequestRepository: {
      countByFilter: async (filter) => {
        countFilter = filter;
        return 1;
      },
      findEngagements: async (filter) => {
        listFilter = filter;
        return [
          {
            _id: "engagement-1",
            mentee: "mentee-1",
            mentor: "mentor-1",
            status: "completed",
          },
        ];
      },
    },
  });
  const res = response();

  await controller.getEngagements(
    { query: { menteeId: "mentee-1", page: "1", limit: "50" } },
    res,
    assert.fail,
  );

  assert.deepEqual(countFilter, { mentee: "mentee-1" });
  assert.deepEqual(listFilter, countFilter);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.engagements.length, 1);
});

test("admin engagement stats return all statuses and forward count failures", async () => {
  const statuses = ["pending", "accepted", "rejected", "referred", "ongoing", "completed"];
  const controller = createController({
    connectRequestRepository: {
      countByStatus: async (status) => statuses.indexOf(status) + 1,
    },
  });
  const { res, error } = await invoke(controller.getEngagementStats, {});

  assert.equal(error, undefined);
  assert.deepEqual(res.body.data, {
    pending: 1,
    accepted: 2,
    rejected: 3,
    referred: 4,
    ongoing: 5,
    completed: 6,
    total: 21,
  });

  const expected = new Error("count failed");
  const failed = await invoke(createController({
    connectRequestRepository: {
      countByStatus: async () => { throw expected; },
    },
  }).getEngagementStats, {});
  assert.equal(failed.error, expected);
});

test("admin engagement query combines status, dates, user IDs, and pagination", async () => {
  let countFilter;
  let findOptions;
  const controller = createController({
    connectRequestRepository: {
      countByFilter: async (filter) => {
        countFilter = filter;
        return 3;
      },
      findEngagements: async (_filter, options) => {
        findOptions = options;
        return [{
          _id: { toString: () => "request-1" },
          mentee: { toString: () => "mentee-1" },
          mentor: { toString: () => "mentor-1" },
          status: "completed",
          message: "Hello",
          selectedSlots: [],
        }];
      },
    },
  });
  const { res, error } = await invoke(controller.getEngagements, {
    query: {
      status: "completed",
      menteeId: "mentee-1",
      dateFrom: "2026-01-02",
      dateTo: "2026-02-03",
      userIds: "mentor-1,mentee-1,,",
      page: "3",
      limit: "25",
    },
  });

  assert.equal(error, undefined);
  assert.deepEqual(countFilter.status, "completed");
  assert.equal(countFilter.mentee, "mentee-1");
  assert.equal(countFilter.requestedAt.$gte.toISOString(), "2026-01-02T00:00:00.000Z");
  const expectedDateTo = new Date("2026-02-03");
  expectedDateTo.setHours(23, 59, 59, 999);
  assert.equal(countFilter.requestedAt.$lte.toISOString(), expectedDateTo.toISOString());
  assert.deepEqual(countFilter.$or, [
    { mentor: { $in: ["mentor-1", "mentee-1"] } },
    { mentee: { $in: ["mentor-1", "mentee-1"] } },
  ]);
  assert.deepEqual(findOptions, { skip: 50, limit: 25 });
  assert.equal(res.body.data.engagements[0]._id, "request-1");
  assert.equal(res.body.data.engagements[0].mentee, "mentee-1");
  assert.equal(res.body.data.pagination.totalPages, 1);
});

test("admin engagement query applies default and maximum pagination and forwards repository errors", async () => {
  let findOptions;
  const controller = createController({
    connectRequestRepository: {
      countByFilter: async () => 0,
      findEngagements: async (_filter, options) => {
        findOptions = options;
        return [];
      },
    },
  });
  const result = await invoke(controller.getEngagements, {
    query: { page: "-1", limit: "1000", userIds: "" },
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(findOptions, { skip: 0, limit: 100 });
  assert.deepEqual(result.res.body.data.engagements, []);
  assert.deepEqual(result.res.body.data.pagination, { total: 0, page: 1, totalPages: 0 });

  const expected = new Error("query failed");
  const failed = await invoke(createController({
    connectRequestRepository: {
      countByFilter: async () => { throw expected; },
      findEngagements: async () => [],
    },
  }).getEngagements, { query: {} });
  assert.equal(failed.error, expected);
});

test("admin engagement list forwards failures from either repository query", async () => {
  const expected = new Error("engagement query failed");
  const failedCount = await invoke(createController({
    connectRequestRepository: {
      countByFilter: async () => { throw expected; },
      findEngagements: async () => [],
    },
  }).getEngagements, { query: {} });
  assert.equal(failedCount.error, expected);

  const failedFind = await invoke(createController({
    connectRequestRepository: {
      countByFilter: async () => 1,
      findEngagements: async () => { throw expected; },
    },
  }).getEngagements, { query: {} });
  assert.equal(failedFind.error, expected);
});
