const test = require("node:test");
const assert = require("node:assert/strict");

const createReportService = require("../../services/report.service");

test("persists a report then queues a report-submitted email with an Identity address", async () => {
  const calls = [];
  const report = { _id: "report-1", complaintType: "other" };
  const service = createReportService({
    reportRepository: {
      findReportByConnectAndReporter: async () => null,
      create: async (data) => {
        calls.push(["create", data]);
        return report;
      },
    },
    connectRequestRepository: {
      findById: async () => ({ mentor: "mentor-1", mentee: "mentee-1" }),
    },
    cloudinaryClient: {},
    identityClient: {
      getUserSummaries: async () => [
        { name: "Mentee", email: "mentee@example.com" },
      ],
    },
    notificationClient: {
      publish: async (event) => calls.push(["publish", event]),
    },
    logger: { warn() {} },
  });

  const result = await service.createIncidentReport({
    userId: "mentee-1",
    body: {
      connectRequestId: "session-1",
      complaintType: "other",
      description: "A sufficiently detailed report",
    },
    correlationId: "corr-1",
  });

  assert.equal(result, report);
  assert.equal(calls[0][0], "create");
  assert.equal(calls[1][0], "publish");
  assert.equal(calls[1][1].eventType, "report.submitted.email");
  assert.equal(calls[1][1].reporterEmail, "mentee@example.com");
  assert.equal(calls[1][1].sourceEventId, "report-email:submitted:report-1");
});
