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
      getStats: async () => { identityCalls += 1; return { data: { totalUsers: 4 } }; },
      getUserGrowth: async () => ({ data: [{ label: "Oct 24", count: 2 }] }),
    },
    profileClient: { getMentorIndustryStats: async () => ({ data: [{ industry: "Tech", count: 1 }] }) },
    workspaceClient: { getEngagementStats: async () => ({ data: { total: 3 } }) },
    cache: createTtlCache(),
  });

  assert.deepEqual(await service.getStats("corr-1"), { totalUsers: 4 });
  assert.deepEqual(await service.getStats("corr-2"), { totalUsers: 4 });
  assert.equal(identityCalls, 1);
  assert.deepEqual(await service.getUserGrowth(30, "corr-3"), [{ label: "Oct 24", count: 2 }]);
  assert.deepEqual(await service.getMentorIndustryStats("corr-4"), [{ industry: "Tech", count: 1 }]);
  assert.deepEqual(await service.getEngagementStats("corr-5"), { total: 3 });
});

test("dashboard routes return the public admin response envelope", async () => {
  const server = http.createServer(createApp({
    health: { isReady: () => true },
    dashboardRouter: createDashboardRouter({
      authenticate: (_req, _res, next) => next(),
      controller: createDashboardController({
        dashboardService: {
          getStats: async () => ({ totalUsers: 4 }),
          getUserGrowth: async () => [{ label: "Oct 24", count: 2 }],
          getMentorIndustryStats: async () => [{ industry: "Tech", count: 1 }],
          getEngagementStats: async () => ({ total: 3 }),
        },
      }),
    }),
  }));
  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/stats`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: { totalUsers: 4 },
      message: "Platform stats retrieved",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("dashboard service preserves internal service failures", async () => {
  const service = createDashboardService({
    identityClient: { getStats: async () => { throw new Error("Identity unavailable"); } },
    profileClient: { getMentorIndustryStats: async () => ({ data: [] }) },
    workspaceClient: { getEngagementStats: async () => ({ data: {} }) },
    cache: createTtlCache(),
  });

  await assert.rejects(service.getStats("corr-error"), /Identity unavailable/);
});
