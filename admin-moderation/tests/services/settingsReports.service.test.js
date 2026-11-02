const test = require("node:test");
const assert = require("node:assert/strict");

const createSettingsService = require("../../services/settings.service");
const createReportsService = require("../../services/reports.service");

test("settings service aggregates overview data and creates a non-super admin", async () => {
  let created;
  const service = createSettingsService({
    adminUserRepository: {
      findAdminByEmail: async () => null,
      createAdmin: async (data) => {
        created = data;
        return { ...data, _id: { toString: () => "admin-2" } };
      },
    },
    identityClient: { getStats: async () => ({ data: { totalUsers: 18 } }) },
    workspaceClient: { getEngagementStats: async () => ({ data: { ongoing: 4 } }) },
    paymentsClient: {},
  });

  assert.deepEqual(await service.getOverview("corr-1"), {
    totalUsers: 18,
    activeSessions: 4,
  });
  const result = await service.addAdmin({ name: "Grace", email: "grace@example.com" });
  assert.equal(created.name, "Grace");
  assert.equal(created.email, "grace@example.com");
  assert.equal(created.isSuperAdmin, false);
  assert.equal(created.isActive, true);
  assert.match(created.password, /A1!$/);
  assert.deepEqual(result.admin, {
    _id: "admin-2",
    name: "Grace",
    email: "grace@example.com",
    isActive: true,
  });
  assert.equal(typeof result.temporaryPassword, "string");
  assert.ok(result.temporaryPassword.length >= 12);
});

test("settings service rejects duplicate admins and changes password with session revocation", async () => {
  let saved;
  const existing = { email: "existing@example.com" };
  const service = createSettingsService({
    adminUserRepository: {
      findAdminByEmail: async (email) => email === existing.email ? existing : null,
      findAdminByIdFull: async () => ({
        comparePassword: async (password) => password === "oldpassword",
        tokenVersion: 2,
      }),
      saveAdmin: async (admin) => { saved = admin; },
    },
    identityClient: {},
    workspaceClient: {},
    paymentsClient: {},
  });

  await assert.rejects(
    service.addAdmin({ name: "Existing", email: existing.email }),
    (error) => error.code === "ADMIN_EXISTS" && error.statusCode === 409,
  );
  await service.changePassword("admin-1", {
    oldPassword: "oldpassword",
    newPassword: "newpassword",
  });
  assert.equal(saved.password, "newpassword");
  assert.equal(saved.tokenVersion, 3);

  await assert.rejects(
    service.changePassword("admin-1", {
      oldPassword: "incorrect",
      newPassword: "newpassword",
    }),
    (error) => error.code === "INVALID_CURRENT_PASSWORD",
  );
});

test("settings service reads the authoritative Payments commission and falls back to Admin settings", async () => {
  let storedRate;
  const service = createSettingsService({
    adminUserRepository: {
      findAdminByIdLean: async () => ({ commissionRate: 7 }),
      updateAdminById: async (_id, update) => { storedRate = update.commissionRate; },
    },
    identityClient: {},
    workspaceClient: {},
    paymentsClient: {
      getCommission: async () => ({ data: { commissionRate: 11 } }),
      updateCommission: async (rate, correlationId) => {
        assert.equal(rate, 9.5);
        assert.equal(correlationId, "corr-2");
      },
    },
  });

  assert.equal(await service.getCommission("admin-1", "corr-1"), 11);
  assert.equal(await service.updateCommission("admin-1", "9.5", "corr-2"), 9.5);
  assert.equal(storedRate, 9.5);
  await assert.rejects(
    service.updateCommission("admin-1", 101, "corr-3"),
    (error) => error.code === "INVALID_COMMISSION_RATE",
  );

  const fallbackService = createSettingsService({
    adminUserRepository: {
      findAdminByIdLean: async () => ({ commissionRate: 6 }),
    },
    identityClient: {},
    workspaceClient: {},
    paymentsClient: { getCommission: async () => { throw new Error("offline"); } },
  });
  assert.equal(await fallbackService.getCommission("admin-1", "corr-4"), 6);
});

test("reports service returns report data, updates status, and deletes session", async () => {
  const calls = [];
  const service = createReportsService({
    workspaceClient: {
      getReportStats: async () => ({ data: { total: 3 } }),
      listReports: async (query, correlationId) => {
        calls.push(["list", query, correlationId]);
        return { data: { reports: [{ _id: "report-1" }], pagination: { total: 1 } } };
      },
      updateReport: async (...args) => {
        calls.push(["update", ...args]);
        return { data: { report: { status: "resolved" } } };
      },
      deleteSession: async (...args) => {
        calls.push(["delete", ...args]);
        return { data: { deleted: true } };
      },
    },
    paymentsClient: {},
  });

  assert.deepEqual(await service.getStats("corr-1"), { total: 3 });
  assert.deepEqual(await service.getReports({ status: "open" }, "corr-2"), {
    reports: [{ _id: "report-1" }],
    pagination: { total: 1 },
  });
  assert.deepEqual(await service.updateReport(
    "report-1",
    { status: "resolved", adminNote: "reviewed" },
    "admin-1",
    "corr-3",
  ), { status: "resolved" });
  assert.deepEqual(await service.deleteSession("report-1", "remove", "admin-1", "corr-4"), {
    deleted: true,
  });
  assert.deepEqual(calls, [
    ["list", { status: "open" }, "corr-2"],
    ["update", "report-1", {
      status: "resolved",
      adminNote: "reviewed",
      resolvedBy: "admin-1",
    }, "corr-3"],
    ["delete", "report-1", { adminNote: "remove", resolvedBy: "admin-1" }, "corr-4"],
  ]);
});

test("refund workflow validates report type, prior processing, session, and calls Payments before resolving", async () => {
  let report = {
    complaintType: "refund",
    refundProcessed: false,
  };
  let session = { _id: "request-1" };
  const calls = [];
  const service = createReportsService({
    workspaceClient: {
      getReport: async () => ({ data: { report, connectRequest: session } }),
      updateReport: async (...args) => { calls.push(["update", ...args]); },
    },
    paymentsClient: {
      refund: async (...args) => {
        calls.push(["refund", ...args]);
        return { data: { totalAmount: 25 } };
      },
    },
  });

  assert.deepEqual(await service.processRefund("report-1", "", "admin-1", "corr-1"), {
    refundAmount: 25,
  });
  assert.deepEqual(calls, [
    ["refund", "request-1", "corr-1"],
    ["update", "report-1", {
      status: "resolved",
      adminNote: "Refund processed by admin.",
      resolvedBy: "admin-1",
      refundProcessed: true,
    }, "corr-1"],
  ]);

  for (const [nextReport, nextSession, code] of [
    [null, session, "REPORT_NOT_FOUND"],
    [{ complaintType: "other", refundProcessed: false }, session, "NOT_REFUND_REPORT"],
    [{ complaintType: "refund", refundProcessed: true }, session, "REFUND_ALREADY_PROCESSED"],
    [{ complaintType: "refund", refundProcessed: false }, null, "SESSION_NOT_FOUND"],
  ]) {
    report = nextReport;
    session = nextSession;
    await assert.rejects(
      service.processRefund("report-1", "note", "admin-1", "corr-2"),
      (error) => error.code === code,
    );
  }
});
