const test = require("node:test");
const assert = require("node:assert/strict");

const createReportService = require("../../services/report.service");

const createFixture = (overrides = {}) => {
  const warnings = [];
  const calls = [];
  const report = { _id: "report-1", complaintType: "other" };
  const service = createReportService({
    reportRepository: {
      findReportByConnectAndReporter: async () => null,
      create: async (data) => {
        calls.push(["create", data]);
        return report;
      },
      ...overrides.reportRepository,
    },
    connectRequestRepository: {
      findById: async () => ({ mentor: "mentor-1", mentee: "mentee-1" }),
      ...overrides.connectRequestRepository,
    },
    cloudinaryClient: {
      uploadRawBuffer: async () => ({ url: "https://image.test/report.jpg", publicId: "asset-1" }),
      destroyRawAsset: async (id) => calls.push(["destroy", id]),
      ...overrides.cloudinaryClient,
    },
    identityClient: overrides.identityClient,
    notificationClient: overrides.notificationClient,
    logger: { warn: (...args) => warnings.push(args) },
  });
  return { service, calls, warnings, report };
};

const validReport = {
  connectRequestId: "session-1",
  complaintType: "other",
  description: "A sufficiently detailed report",
};

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

test("validates report fields, session existence, participant, complaint type, and description", async () => {
  const fixture = createFixture();
  for (const body of [{}, { ...validReport, description: " " }]) {
    await assert.rejects(
      fixture.service.createIncidentReport({ userId: "mentee-1", body }),
      { code: "INVALID_REPORT_REQUEST" },
    );
  }
  const missingSession = createFixture({ connectRequestRepository: { findById: async () => null } });
  await assert.rejects(
    missingSession.service.createIncidentReport({ userId: "mentee-1", body: validReport }),
    { code: "SESSION_NOT_FOUND" },
  );
  await assert.rejects(
    fixture.service.createIncidentReport({ userId: "outsider", body: validReport }),
    { code: "NOT_SESSION_PARTICIPANT" },
  );
  await assert.rejects(
    fixture.service.createIncidentReport({
      userId: "mentee-1",
      body: { ...validReport, complaintType: "unknown" },
    }),
    { code: "INVALID_REPORT_REQUEST" },
  );
  await assert.rejects(
    fixture.service.createIncidentReport({
      userId: "mentee-1",
      body: { ...validReport, description: "too short" },
    }),
    { code: "INVALID_REPORT_REQUEST" },
  );
});

test("recognizes object participant IDs, validates duplicate reports, and uploads evidence", async () => {
  const uploaded = [];
  const request = {
    mentor: { _id: "mentor-1" },
    mentee: { _id: "mentee-1" },
  };
  const fixture = createFixture({
    connectRequestRepository: { findById: async () => request },
    cloudinaryClient: {
      uploadRawBuffer: async (buffer, options) => {
        uploaded.push({ buffer, options });
        return { url: "https://image.test/evidence.webp", publicId: "evidence-1" };
      },
    },
  });
  const result = await fixture.service.createIncidentReport({
    userId: "mentor-1",
    body: validReport,
    file: { buffer: Buffer.from("image") },
  });
  assert.equal(result, fixture.report);
  assert.deepEqual(uploaded[0].options, {
    folder: "leapmentor/reports/session-1",
    resource_type: "image",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  });
  assert.equal(fixture.calls[0][1].reportedUser, request.mentee);
  assert.equal(fixture.calls[0][1].reporterRole, "mentor");
  assert.equal(fixture.calls[0][1].screenshotPublicId, "evidence-1");

  const duplicate = createFixture({
    reportRepository: {
      findReportByConnectAndReporter: async () => ({ _id: "existing" }),
    },
  });
  await assert.rejects(
    duplicate.service.createIncidentReport({ userId: "mentee-1", body: validReport }),
    { code: "REPORT_EXISTS" },
  );
});

test("converts screenshot provider errors and cleans up uploaded assets after persistence failure", async () => {
  const uploadFailure = createFixture({
    cloudinaryClient: { uploadRawBuffer: async () => { throw new Error("provider failed"); } },
  });
  await assert.rejects(
    uploadFailure.service.createIncidentReport({
      userId: "mentee-1",
      body: validReport,
      file: { buffer: Buffer.from("image") },
    }),
    { code: "UPLOAD_PROVIDER_FAILED" },
  );

  const persistenceError = new Error("database write failed");
  const saveFailure = createFixture({
    reportRepository: { create: async () => { throw persistenceError; } },
    cloudinaryClient: {
      destroyRawAsset: async () => { throw new Error("cleanup failed"); },
    },
  });
  await assert.rejects(
    saveFailure.service.createIncidentReport({
      userId: "mentee-1",
      body: validReport,
      file: { buffer: Buffer.from("image") },
    }),
    (error) => error === persistenceError,
  );
  assert.equal(saveFailure.warnings.length, 1);
});

test("report submission continues when email details are missing or notification fails", async () => {
  const noEmail = createFixture({
    identityClient: { getUserSummaries: async () => [{ name: "Reporter" }] },
    notificationClient: { publish: async () => assert.fail("email should not publish") },
  });
  await noEmail.service.createIncidentReport({
    userId: "mentee-1",
    body: validReport,
  });

  const failedEmail = createFixture({
    identityClient: { getUserSummaries: async () => { throw new Error("identity unavailable"); } },
    notificationClient: { publish: async () => null },
  });
  const result = await failedEmail.service.createIncidentReport({
    userId: "mentee-1",
    body: validReport,
  });
  assert.equal(result, failedEmail.report);
  assert.equal(failedEmail.warnings.length, 1);

  const failedPublish = createFixture({
    identityClient: { getUserSummaries: async () => [{ email: "reporter@example.com" }] },
    notificationClient: { publish: async () => { throw new Error("outbox unavailable"); } },
  });
  await failedPublish.service.createIncidentReport({
    userId: "mentee-1",
    body: validReport,
  });
  assert.equal(failedPublish.warnings.length, 1);
});

test("reads a participant's own report and rejects missing sessions or nonparticipants", async () => {
  let lookup;
  const fixture = createFixture({
    connectRequestRepository: {
      findById: async () => ({
        mentor: { _id: "mentor-1" },
        mentee: { _id: "mentee-1" },
      }),
    },
    reportRepository: {
      findReportByConnectAndReporter: async (...args) => {
        lookup = args;
        return { _id: "report-1" };
      },
    },
  });
  const result = await fixture.service.getMySessionReport("session-1", "mentee-1");
  assert.deepEqual(result, { report: { _id: "report-1" } });
  assert.deepEqual(lookup, ["session-1", "mentee-1"]);
  await assert.rejects(
    fixture.service.getMySessionReport("session-1", "outsider"),
    { code: "NOT_SESSION_PARTICIPANT" },
  );

  const missing = createFixture({
    connectRequestRepository: { findById: async () => null },
  });
  await assert.rejects(
    missing.service.getMySessionReport("missing", "mentee-1"),
    { code: "SESSION_NOT_FOUND" },
  );
});
