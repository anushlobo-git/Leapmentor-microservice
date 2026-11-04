const test = require("node:test");
const assert = require("node:assert/strict");

const createController = require("../../controllers/internalAdminReports.controller");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
});

const report = {
  _id: "507f1f77bcf86cd799439011",
  connectRequest: "507f1f77bcf86cd799439012",
  reportedBy: "507f1f77bcf86cd799439013",
  reportedUser: "507f1f77bcf86cd799439014",
  reporterRole: "mentee",
  complaintType: "other",
  description: "Issue",
  createdAt: "2026-10-29T10:00:00.000Z",
};

const request = {
  _id: "507f1f77bcf86cd799439012",
  mentee: "507f1f77bcf86cd799439013",
  mentor: "507f1f77bcf86cd799439014",
  status: "accepted",
  paymentStatus: "paid",
  totalAmount: 12,
};

const dependencies = () => ({
  reportRepository: {
    countAllReports: async () => 4,
    countReportsByFilter: async () => 1,
    findReports: async () => [report],
    findById: async () => report,
    updateById: async () => report,
  },
  connectRequestRepository: {
    findById: async () => request,
  },
  identityClient: {
    getUserSummaries: async () => [
      { _id: report.reportedBy, name: "Mentee Name", email: "mentee@example.com" },
      { _id: report.reportedUser, name: "Mentor Name", email: "mentor@example.com" },
    ],
  },
  notificationClient: { publish: async () => null },
});

const invoke = async (handler, req) => {
  const res = response();
  let error;
  await handler(req, res, (value) => { error = value; });
  return { res, error };
};

test("admin report list includes populated participant details and legacy flat fields", async () => {
  const controller = createController(dependencies());
  const res = response();

  await controller.getReports({ query: { page: "1", limit: "10" }, correlationId: "corr-1" }, res, assert.fail);

  const item = res.body.data.reports[0];
  assert.equal(item.mentee, "Mentee Name");
  assert.equal(item.menteeEmail, "mentee@example.com");
  assert.equal(item.mentor, "Mentor Name");
  assert.equal(item.mentorEmail, "mentor@example.com");
  assert.equal(item.reportedBy, "Mentee Name");
  assert.equal(item.date, "2026-10-29");
  assert.equal(item.connectRequestId, request._id);
});

test("admin report detail includes the same populated report contract", async () => {
  const controller = createController(dependencies());
  const res = response();

  await controller.getReport({ params: { reportId: report._id }, correlationId: "corr-2" }, res, assert.fail);

  assert.equal(res.body.data.report.mentee, "Mentee Name");
  assert.equal(res.body.data.report.mentor, "Mentor Name");
  assert.equal(res.body.data.report.reportedBy, "Mentee Name");
  assert.equal(res.body.data.connectRequest._id, request._id);
});

test("admin report stats returns aggregate counts and forwards repository errors", async () => {
  const controller = createController(dependencies());
  const { res, error } = await invoke(controller.getStats, {});

  assert.equal(error, undefined);
  assert.deepEqual(res.body.data, {
    totalReports: 4,
    pendingResolution: 1,
    resolvedToday: 1,
  });

  const expectedError = new Error("counts unavailable");
  const failing = createController({
    reportRepository: {
      countAllReports: async () => { throw expectedError; },
      countReportsByFilter: async () => 0,
    },
  });
  const failed = await invoke(failing.getStats, {});
  assert.equal(failed.error, expectedError);
});

test("admin report list clamps pagination, supports status filtering, and handles unlinked reports", async () => {
  const deps = dependencies();
  let countFilter;
  let findOptions;
  deps.reportRepository.countReportsByFilter = async (filter) => {
    countFilter = filter;
    return 0;
  };
  deps.reportRepository.findReports = async (_filter, options) => {
    findOptions = options;
    return [{
      _id: report._id,
      reportedBy: "raw-reporter",
      reportedUser: "raw-user",
      reporterRole: "mentee",
    }];
  };
  deps.identityClient = null;
  const controller = createController(deps);
  const { res, error } = await invoke(controller.getReports, {
    query: { status: "resolved", page: "0", limit: "500" },
  });

  assert.equal(error, undefined);
  assert.deepEqual(countFilter, { status: "resolved" });
  assert.deepEqual(findOptions, { skip: 0, limit: 100 });
  assert.equal(res.body.data.pagination.page, 1);
  assert.equal(res.body.data.pagination.limit, 100);
  assert.equal(res.body.data.reports[0].mentee, "raw-reporter");
  assert.equal(res.body.data.reports[0].mentor, "raw-user");
  assert.equal(res.body.data.reports[0].sessionStatus, null);
});

test("admin report detail validates IDs, handles missing reports, and supports reports without a session", async () => {
  const deps = dependencies();
  const controller = createController(deps);
  const invalid = await invoke(controller.getReport, { params: { reportId: "invalid" } });
  assert.equal(invalid.res.statusCode, 400);
  assert.equal(invalid.res.body.code, "INVALID_REPORT_ID");

  deps.reportRepository.findById = async () => null;
  const missing = await invoke(controller.getReport, {
    params: { reportId: report._id },
  });
  assert.equal(missing.res.statusCode, 404);
  assert.equal(missing.res.body.code, "REPORT_NOT_FOUND");

  deps.reportRepository.findById = async () => ({
    ...report,
    connectRequest: null,
    reporterRole: "mentor",
  });
  deps.identityClient = null;
  const unlinked = await invoke(createController(deps).getReport, {
    params: { reportId: report._id },
  });
  assert.equal(unlinked.res.statusCode, 200);
  assert.equal(unlinked.res.body.data.connectRequest, null);
  assert.equal(unlinked.res.body.data.report.mentee, report.reportedUser);
  assert.equal(unlinked.res.body.data.report.mentor, report.reportedBy);
  assert.equal(unlinked.res.body.data.report.date, "2026-10-29");
});

test("admin report update validates input, records optional fields, and notifies the reporter", async () => {
  const deps = dependencies();
  const updates = [];
  const notifications = [];
  deps.reportRepository.updateById = async (_id, update) => {
    updates.push(update);
    return {
      ...report,
      resolvedAt: update.resolvedAt,
    };
  };
  deps.notificationClient.publish = async (event) => notifications.push(event);
  deps.identityClient.getUserSummaries = async () => [
    { name: "Reporter", email: "reporter@example.com" },
  ];
  const controller = createController(deps);
  const invalidId = await invoke(controller.updateReport, {
    params: { reportId: "bad" },
    body: { status: "resolved" },
  });
  assert.equal(invalidId.res.statusCode, 400);
  assert.equal(invalidId.res.body.code, "INVALID_REPORT_ID");

  const invalidStatus = await invoke(controller.updateReport, {
    params: { reportId: report._id },
    body: { status: "unknown" },
  });
  assert.equal(invalidStatus.res.statusCode, 400);
  assert.equal(invalidStatus.res.body.code, "INVALID_REPORT_STATUS");

  const updated = await invoke(controller.updateReport, {
    params: { reportId: report._id },
    body: {
      status: "resolved",
      adminNote: "  reviewed  ",
      resolvedBy: "admin-1",
      refundProcessed: true,
    },
    correlationId: "corr-update",
  });
  assert.equal(updated.error, undefined);
  assert.equal(updated.res.statusCode, 200);
  assert.equal(updates[0].adminNote, "reviewed");
  assert.equal(updates[0].resolvedBy, "admin-1");
  assert.equal(updates[0].refundProcessed, true);
  assert.ok(updates[0].refundedAt instanceof Date);
  assert.ok(updates[0].resolvedAt instanceof Date);
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].title, "Your report has been resolved");
  assert.equal(notifications[0].message.endsWith("Note: reviewed"), true);
  assert.equal(notifications[1].reporterEmail, "reporter@example.com");
});

test("admin report update handles dismissed reports, absent reporters, and missing records", async () => {
  const deps = dependencies();
  const notifications = [];
  deps.notificationClient.publish = async (event) => notifications.push(event);
  deps.identityClient = null;
  deps.reportRepository.updateById = async (_id, update) => ({
    ...report,
    reportedBy: null,
    resolvedAt: update.resolvedAt,
  });
  const controller = createController(deps);
  const dismissed = await invoke(controller.updateReport, {
    params: { reportId: report._id },
    body: { status: "dismissed" },
  });
  assert.equal(dismissed.res.statusCode, 200);
  assert.equal(notifications.length, 0);

  deps.reportRepository.updateById = async () => null;
  const missing = await invoke(controller.updateReport, {
    params: { reportId: report._id },
    body: { status: "open", adminNote: 12, refundProcessed: false },
  });
  assert.equal(missing.res.statusCode, 404);
  assert.equal(missing.res.body.code, "REPORT_NOT_FOUND");
});

test("report resolution tolerates missing reporter emails and identity delivery failures", async () => {
  const deps = dependencies();
  const notifications = [];
  deps.reportRepository.updateById = async (_id, update) => ({
    ...report,
    resolvedAt: update.resolvedAt,
  });
  deps.notificationClient.publish = async (event) => notifications.push(event);
  deps.identityClient.getUserSummaries = async () => [{ name: "Reporter" }];
  const controller = createController(deps);
  const noEmail = await invoke(controller.updateReport, {
    params: { reportId: report._id },
    body: { status: "dismissed" },
  });
  assert.equal(noEmail.res.statusCode, 200);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, "Your report has been dismissed");

  deps.identityClient.getUserSummaries = async () => { throw new Error("Identity unavailable"); };
  const originalWrite = process.stderr.write;
  const errors = [];
  process.stderr.write = (message) => { errors.push(String(message)); return true; };
  try {
    const failedEmail = await invoke(createController(deps).updateReport, {
      params: { reportId: report._id },
      body: { status: "resolved" },
    });
    assert.equal(failedEmail.res.statusCode, 200);
  } finally {
    process.stderr.write = originalWrite;
  }
  assert.equal(errors.some((message) => message.includes("Identity unavailable")), true);
});

test("admin session deletion validates the report and session and deletes linked records", async () => {
  const deps = dependencies();
  const deleted = [];
  const updates = [];
  const notifications = [];
  deps.connectRequestRepository.deleteRequestById = async (id) => deleted.push(id);
  deps.reportRepository.updateById = async (id, value) => updates.push([id, value]);
  deps.notificationClient.publish = async (event) => notifications.push(event);
  const controller = createController(deps);

  const invalid = await invoke(controller.deleteSession, {
    params: { reportId: "bad" },
  });
  assert.equal(invalid.res.statusCode, 400);

  deps.reportRepository.findById = async () => null;
  const missingReport = await invoke(controller.deleteSession, {
    params: { reportId: report._id },
  });
  assert.equal(missingReport.res.statusCode, 404);
  assert.equal(missingReport.res.body.code, "REPORT_NOT_FOUND");

  deps.reportRepository.findById = async () => ({ ...report, connectRequest: null });
  const missingSession = await invoke(controller.deleteSession, {
    params: { reportId: report._id },
  });
  assert.equal(missingSession.res.statusCode, 404);
  assert.equal(missingSession.res.body.code, "SESSION_NOT_FOUND");

  deps.reportRepository.findById = async () => report;
  const result = await invoke(controller.deleteSession, {
    params: { reportId: report._id },
    body: { adminNote: "  removed  ", resolvedBy: "admin-2" },
    correlationId: "corr-delete",
  });
  assert.equal(result.error, undefined);
  assert.equal(result.res.statusCode, 200);
  assert.deepEqual(deleted, [request._id]);
  assert.equal(updates[0][1].status, "resolved");
  assert.equal(updates[0][1].adminNote, "removed");
  assert.equal(updates[0][1].resolvedBy, "admin-2");
  assert.equal(notifications.length, 2);
  assert.deepEqual(notifications.map((event) => event.recipient), [
    request.mentee,
    request.mentor,
  ]);
});

test("admin report endpoints forward repository failures", async () => {
  const expected = new Error("repository unavailable");
  const deps = dependencies();
  deps.reportRepository.findReports = async () => { throw expected; };
  const controller = createController(deps);
  const list = await invoke(controller.getReports, { query: {} });
  assert.equal(list.error, expected);

  deps.reportRepository.findById = async () => { throw expected; };
  const detail = await invoke(controller.getReport, { params: { reportId: report._id } });
  assert.equal(detail.error, expected);

  deps.reportRepository.updateById = async () => { throw expected; };
  const update = await invoke(controller.updateReport, {
    params: { reportId: report._id },
    body: { status: "open" },
  });
  assert.equal(update.error, expected);

  const deletionDeps = dependencies();
  deletionDeps.connectRequestRepository.deleteRequestById = async () => { throw expected; };
  const deletion = await invoke(createController(deletionDeps).deleteSession, {
    params: { reportId: report._id },
  });
  assert.equal(deletion.error, expected);
});
