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
    countReportsByFilter: async () => 1,
    findReports: async () => [report],
    findById: async () => report,
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
