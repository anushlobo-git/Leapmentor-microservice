const http = require("node:http");
const test = require("node:test");
const assert = require("node:assert/strict");

const createApp = require("../app");
const createSettingsRouter = require("../routes/settings.routes");
const createReportsRouter = require("../routes/reports.routes");
const createVerificationRouter = require("../routes/verification.routes");
const validation = require("../middleware/settingsValidation");
const createReportsService = require("../services/reports.service");

const startServer = async (container) => {
  const server = http.createServer(createApp(container));
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
};

const authenticate = (req, _res, next) => {
  req.admin = { _id: "507f1f77bcf86cd799439011" };
  next();
};

test("settings, reports, and verification routes are mounted behind Admin authentication", async () => {
  const calls = [];
  const serverDetails = await startServer({
    health: { isReady: () => true },
    settingsRouter: createSettingsRouter({
      authenticate,
      validation,
      controller: {
        getOverview: (_req, res) => res.json({ route: "overview" }),
        addAdmin: (_req, res) => res.status(201).json({ route: "add-admin" }),
        changePassword: (_req, res) => res.json({ route: "change-password" }),
        getCommission: (_req, res) => res.json({ route: "commission-get" }),
        updateCommission: (req, res) => { calls.push(req.body.commissionRate); res.json({ route: "commission-put" }); },
      },
    }),
    reportsRouter: createReportsRouter({
      authenticate,
      controller: {
        getStats: (_req, res) => res.json({ route: "report-stats" }),
        getReports: (_req, res) => res.json({ route: "reports" }),
        updateReport: (_req, res) => res.json({ route: "report-update" }),
        processRefund: (_req, res) => res.json({ route: "refund" }),
        deleteSession: (_req, res) => res.json({ route: "delete-session" }),
      },
    }),
    verificationRouter: createVerificationRouter({
      authenticate,
      controller: {
        list: (_req, res) => res.json({ route: "verification-list" }),
        getById: (_req, res) => res.json({ route: "verification-detail" }),
        verify: (_req, res) => res.json({ route: "verification-verify" }),
        revoke: (_req, res) => res.json({ route: "verification-revoke" }),
      },
    }),
  });

  try {
    const overview = await fetch(`${serverDetails.url}/api/v1/admin/settings/overview`);
    const commission = await fetch(`${serverDetails.url}/api/v1/admin/settings/commission`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commissionRate: 18 }) });
    const reportStats = await fetch(`${serverDetails.url}/api/v1/admin/reports/stats`);
    const verificationList = await fetch(`${serverDetails.url}/api/v1/admin/mentor-verifications`);
    assert.equal(overview.status, 200);
    assert.equal(commission.status, 200);
    assert.equal(reportStats.status, 200);
    assert.equal(verificationList.status, 200);
    assert.deepEqual(calls, [18]);
  } finally {
    await new Promise((resolve) => serverDetails.server.close(resolve));
  }
});

test("reports service processes a refund through Payments and then resolves the Workspace report", async () => {
  const calls = [];
  const service = createReportsService({
    workspaceClient: {
      getReport: async () => ({ data: { report: { complaintType: "refund", refundProcessed: false }, connectRequest: { _id: "request-1" } } }),
      updateReport: async (...args) => { calls.push(args); return { data: { report: { status: "resolved" } } }; },
    },
    paymentsClient: { refund: async () => ({ data: { totalAmount: 42 } }) },
  });

  assert.deepEqual(await service.processRefund("report-1", "Approved", "admin-1", "corr-1"), { refundAmount: 42 });
  assert.deepEqual(calls, [["report-1", { status: "resolved", adminNote: "Approved", resolvedBy: "admin-1", refundProcessed: true }, "corr-1"]]);
});
