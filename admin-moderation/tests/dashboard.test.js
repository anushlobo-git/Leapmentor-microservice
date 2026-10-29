const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../app");
const createDashboardService = require("../services/dashboard.service");
const createDashboardController = require("../controllers/dashboard.controller");
const createDashboardRouter = require("../routes/dashboard.routes");
const createTtlCache = require("../utils/ttlCache");

test("dashboard service caches telemetry and delegates to owning services", async () => {
  let identityCalls = 0;
  const service = createDashboardService({
    identityClient: {
      getStats: async () => {
        identityCalls += 1;
        return { data: { totalUsers: 4 } };
      },
      getUserGrowth: async () => ({ data: [{ label: "Oct 24", count: 2 }] }),
    },
    profileClient: {
      getMentorIndustryStats: async () => ({
        data: [{ industry: "Tech", count: 1 }],
      }),
    },
    workspaceClient: {
      getEngagementStats: async () => ({ data: { total: 3 } }),
    },
    cache: createTtlCache(),
  });

  assert.deepEqual(await service.getStats("corr-1"), { totalUsers: 4 });
  assert.deepEqual(await service.getStats("corr-2"), { totalUsers: 4 });
  assert.equal(identityCalls, 1);
  assert.deepEqual(await service.getUserGrowth(30, "corr-3"), [
    { label: "Oct 24", count: 2 },
  ]);
  assert.deepEqual(await service.getMentorIndustryStats("corr-4"), [
    { industry: "Tech", count: 1 },
  ]);
  assert.deepEqual(await service.getEngagementStats("corr-5"), { total: 3 });
});

test("dashboard routes return the public admin response envelope", async () => {
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      dashboardRouter: createDashboardRouter({
        authenticate: (_req, _res, next) => next(),
        controller: createDashboardController({
          dashboardService: {
            getStats: async () => ({ totalUsers: 4 }),
            getUserGrowth: async () => [{ label: "Oct 24", count: 2 }],
            getMentorIndustryStats: async () => [
              { industry: "Tech", count: 1 },
            ],
            getEngagementStats: async () => ({ total: 3 }),
            getEngagements: async () => ({
              engagements: [{ _id: "request-1", mentee: { name: "Mentee" } }],
              pagination: { total: 1, page: 1, totalPages: 1 },
            }),
          },
        }),
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/admin/stats`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: { totalUsers: 4 },
      message: "Platform stats retrieved",
    });

    const engagementsResponse = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/admin/engagements?page=1&limit=15`,
    );
    assert.equal(engagementsResponse.status, 200);
    assert.deepEqual(await engagementsResponse.json(), {
      success: true,
      data: {
        engagements: [{ _id: "request-1", mentee: { name: "Mentee" } }],
        pagination: { total: 1, page: 1, totalPages: 1 },
      },
      message: "Engagements retrieved",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("dashboard service preserves internal service failures", async () => {
  const service = createDashboardService({
    identityClient: {
      getStats: async () => {
        throw new Error("Identity unavailable");
      },
    },
    profileClient: { getMentorIndustryStats: async () => ({ data: [] }) },
    workspaceClient: { getEngagementStats: async () => ({ data: {} }) },
    cache: createTtlCache(),
  });

  await assert.rejects(service.getStats("corr-error"), /Identity unavailable/);
});

test("engagement list filters through Workspace and decorates participant summaries", async () => {
  let workspaceQuery;
  const service = createDashboardService({
    identityClient: {
      listUsers: async () => ({
        data: {
          users: [
            {
              _id: "mentee-1",
              name: "Mentee One",
              email: "mentee@example.com",
            },
          ],
        },
      }),
      getUser: async (userId) => ({
        data: {
          user: {
            _id: userId,
            name: "Mentor One",
            email: "mentor@example.com",
          },
        },
      }),
    },
    profileClient: {},
    workspaceClient: {
      getEngagements: async (query) => {
        workspaceQuery = query;
        return {
          data: {
            engagements: [
              {
                _id: "request-1",
                mentee: "mentee-1",
                mentor: "mentor-1",
                status: "completed",
              },
            ],
            pagination: { total: 1, page: 2, totalPages: 1 },
          },
        };
      },
    },
    cache: createTtlCache(),
  });

  const result = await service.getEngagements(
    {
      search: "Mentee One",
      status: "completed",
      page: 2,
      limit: 10,
      dateFrom: "2026-01-01",
    },
    "corr-engagements",
  );

  assert.equal(workspaceQuery.userIds, "mentee-1");
  assert.equal(workspaceQuery.status, "completed");
  assert.equal(workspaceQuery.dateFrom, "2026-01-01");
  assert.deepEqual(result.engagements[0].mentee, {
    _id: "mentee-1",
    name: "Mentee One",
    email: "mentee@example.com",
  });
  assert.deepEqual(result.engagements[0].mentor, {
    _id: "mentor-1",
    name: "Mentor One",
    email: "mentor@example.com",
  });
  assert.deepEqual(result.pagination, { total: 1, page: 2, totalPages: 1 });
});

test("engagement route rejects invalid filters before calling the service", async () => {
  let serviceCalls = 0;
  const server = http.createServer(
    createApp({
      health: { isReady: () => true },
      dashboardRouter: createDashboardRouter({
        authenticate: (_req, _res, next) => next(),
        controller: createDashboardController({
          dashboardService: {
            getEngagements: async () => {
              serviceCalls += 1;
              return {
                engagements: [],
                pagination: { total: 0, page: 1, totalPages: 0 },
              };
            },
          },
        }),
      }),
    }),
  );
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/admin/engagements?status=unknown`,
    );
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_ENGAGEMENT_QUERY");
    assert.equal(serviceCalls, 0);

    const validIsoDate = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/admin/engagements?dateFrom=2026-10-29T00%3A00%3A00-05%3A00`,
    );
    assert.equal(validIsoDate.status, 200);
    assert.equal(serviceCalls, 1);

    const invalidDate = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/admin/engagements?dateFrom=2026-02-31`,
    );
    assert.equal(invalidDate.status, 400);
    assert.equal(serviceCalls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
