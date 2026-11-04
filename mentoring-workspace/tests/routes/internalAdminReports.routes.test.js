const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../../app");
const createInternalServiceAuth = require("../../middleware/internalServiceAuth");
const createRouter = require("../../routes/internalAdminReports.routes");
const createController = require("../../controllers/internalAdminReports.controller");

test("internal report routes require the Admin service token and expose report stats", async () => {
  const router = createRouter({
    controller: {
      getStats: (_req, res) => res.json({ data: { totalReports: 2 } }),
      getReports: (_req, res) => res.json({ data: { reports: [] } }),
      getReport: (_req, res) => res.json({ data: { report: {} } }),
      updateReport: (_req, res) => res.json({ data: { report: {} } }),
      deleteSession: (_req, res) => res.json({ data: null }),
    },
  });
  const server = http.createServer(createApp({
    health: { isReady: () => true },
    internalAdminServiceAuth: createInternalServiceAuth({ serviceToken: "admin-token" }),
    internalAdminReportsRouter: router,
  }));
  await new Promise((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await fetch(`${url}/internal/v1/admin/reports/stats`, { headers: { Authorization: "Bearer admin-token" } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { totalReports: 2 } });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("terminal report decisions publish a reporter notification after persistence", async () => {
  const events = [];
  const controller = createController({
    reportRepository: {
      updateById: async () => ({
        _id: "507f1f77bcf86cd799439011",
        reportedBy: "507f1f77bcf86cd799439012",
        resolvedAt: new Date(),
      }),
    },
    connectRequestRepository: { findById: async () => null },
    notificationClient: { publish: async (event) => events.push(event) },
  });
  const response = {
    status: () => response,
    json: (body) => body,
  };

  await controller.updateReport({
    params: { reportId: "507f1f77bcf86cd799439011" },
    body: { status: "resolved", adminNote: "Reviewed" },
    correlationId: "corr-report",
  }, response, (error) => { throw error; });

  assert.equal(events.length, 1);
  assert.equal(events[0].recipient, "507f1f77bcf86cd799439012");
  assert.equal(events[0].type, "new_review");
});
