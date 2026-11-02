const test = require("node:test");
const assert = require("node:assert/strict");

const createInternalHttpClient = require("../../clients/internalHttpClient");
const createPaymentsAdminClient = require("../../clients/paymentsAdminClient");
const createProfileAdminClient = require("../../clients/profileAdminClient");
const createWorkspaceAdminClient = require("../../clients/workspaceAdminClient");

const captureClient = () => {
  const calls = [];
  return {
    calls,
    httpClient: {
      request: async (request) => {
        calls.push(request);
        return { success: true };
      },
    },
  };
};

test("Payments Admin client builds request contracts for settings, refunds, requests, and transactions", async () => {
  const { calls, httpClient } = captureClient();
  const client = createPaymentsAdminClient({ httpClient });

  await client.getCommission("corr");
  await client.updateCommission(12.5, "corr");
  await client.refund("request/1", "corr");
  await client.listLeapRequests("pending status", "corr");
  await client.listLeapRequests(undefined, "corr");
  await client.getPendingLeapRequestCount("corr");
  await client.approveLeapRequest("request/1", "admin-1", "corr");
  await client.rejectLeapRequest("request-2", "admin-2", "corr");
  await client.getAdminPaymentSummary("corr");
  await client.getAdminPaymentTransactions(
    { page: 2, limit: 10, type: "credit", userIds: "a,b" },
    "corr",
  );

  assert.deepEqual(calls, [
    { method: "GET", path: "/internal/v1/settings/commission", correlationId: "corr" },
    { method: "PUT", path: "/internal/v1/settings/commission", body: { commissionRate: 12.5 }, correlationId: "corr" },
    { method: "POST", path: "/internal/v1/refunds", body: { requestId: "request/1" }, correlationId: "corr" },
    { method: "GET", path: "/internal/v1/leap-requests?status=pending%20status", correlationId: "corr" },
    { method: "GET", path: "/internal/v1/leap-requests", correlationId: "corr" },
    { method: "GET", path: "/internal/v1/leap-requests/pending-count", correlationId: "corr" },
    { method: "PATCH", path: "/internal/v1/leap-requests/request%2F1/approve", body: { adminId: "admin-1" }, correlationId: "corr" },
    { method: "PATCH", path: "/internal/v1/leap-requests/request-2/reject", body: { adminId: "admin-2" }, correlationId: "corr" },
    { method: "GET", path: "/internal/v1/admin/payments/summary", correlationId: "corr" },
    { method: "GET", path: "/internal/v1/admin/payments/transactions?page=2&limit=10&type=credit&userIds=a%2Cb", correlationId: "corr" },
  ]);
});

test("Profile Admin client builds profile, industry, and verification requests", async () => {
  const { calls, httpClient } = captureClient();
  const client = createProfileAdminClient({ httpClient });

  await client.getProfiles(["id-1", "id/2"], "corr");
  await client.getMentorIndustryStats("corr");
  await client.listMentorVerifications("corr");
  await client.getMentorVerification("profile/1", "corr");
  await client.verifyMentor("profile/1", "corr");
  await client.revokeMentor("profile/2", "corr");

  assert.deepEqual(calls.map(({ method, path, correlationId }) => [method, path, correlationId]), [
    ["GET", "/internal/v1/admin/profiles?ids=id-1,id%2F2", "corr"],
    ["GET", "/internal/v1/admin/stats/mentor-industries", "corr"],
    ["GET", "/internal/v1/admin/mentor-verifications", "corr"],
    ["GET", "/internal/v1/admin/mentor-verifications/profile%2F1", "corr"],
    ["PATCH", "/internal/v1/admin/mentor-verifications/profile%2F1/verify", "corr"],
    ["PATCH", "/internal/v1/admin/mentor-verifications/profile%2F2/revoke", "corr"],
  ]);
});

test("Workspace Admin client forwards engagement, user, payment, and report requests", async () => {
  const { calls, httpClient } = captureClient();
  const client = createWorkspaceAdminClient({ httpClient });

  await client.getPaymentStats("corr");
  await client.getPaymentChart("corr");
  await client.getCompletedSessionCount("user/1", "corr");
  await client.getEngagementStats("corr");
  await client.getEngagements(
    {
      status: "completed",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      page: 2,
      limit: 50,
      userIds: "u1,u2",
      menteeId: "u3",
      ignored: "not-forwarded",
    },
    "corr",
  );
  await client.getReportStats("corr");
  await client.listReports({ status: "open", page: 3, limit: 10 }, "corr");
  await client.getReport("report/1", "corr");
  await client.updateReport("report/1", { status: "resolved" }, "corr");
  await client.deleteSession("report/1", { adminNote: "review" }, "corr");

  assert.deepEqual(calls.map(({ method, path, body }) => [method, path, body]), [
    ["GET", "/internal/v1/admin/payments/stats", undefined],
    ["GET", "/internal/v1/admin/payments/chart", undefined],
    ["GET", "/internal/v1/admin/users/user%2F1/completed-session-count", undefined],
    ["GET", "/internal/v1/admin/engagements/stats", undefined],
    ["GET", "/internal/v1/admin/engagements?status=completed&dateFrom=2026-01-01&dateTo=2026-01-31&page=2&limit=50&userIds=u1%2Cu2&menteeId=u3", undefined],
    ["GET", "/internal/v1/admin/reports/stats", undefined],
    ["GET", "/internal/v1/admin/reports?status=open&page=3&limit=10", undefined],
    ["GET", "/internal/v1/admin/reports/report%2F1", undefined],
    ["PATCH", "/internal/v1/admin/reports/report%2F1", { status: "resolved" }],
    ["DELETE", "/internal/v1/admin/reports/report%2F1/session", { adminNote: "review" }],
  ]);
});

test("internal HTTP client sends auth, correlation, JSON payloads, and parses responses", async () => {
  let fetchArgs;
  const client = createInternalHttpClient({
    baseUrl: "http://identity:5001",
    serviceToken: "service-token",
    fetchImpl: async (...args) => {
      fetchArgs = args;
      return {
        ok: true,
        text: async () => JSON.stringify({ data: { id: "user-1" } }),
      };
    },
  });

  const result = await client.request({
    method: "POST",
    path: "/internal/v1/users",
    body: { name: "Ada" },
    correlationId: "corr-1",
  });
  assert.deepEqual(result, { data: { id: "user-1" } });
  assert.equal(fetchArgs[0], "http://identity:5001/internal/v1/users");
  assert.equal(fetchArgs[1].headers.Authorization, "Bearer service-token");
  assert.equal(fetchArgs[1].headers["X-Correlation-ID"], "corr-1");
  assert.equal(fetchArgs[1].headers["Content-Type"], "application/json");
  assert.equal(fetchArgs[1].body, JSON.stringify({ name: "Ada" }));
});

test("internal HTTP client validates setup and surfaces HTTP, text, and timeout errors", async () => {
  assert.throws(() => createInternalHttpClient({ baseUrl: "" }), /base URL/);
  assert.throws(
    () => createInternalHttpClient({ baseUrl: "http://service", fetchImpl: null }),
    /fetch implementation/,
  );

  const httpFailure = createInternalHttpClient({
    baseUrl: "http://service",
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ error: "service unavailable" }),
    }),
  });
  await assert.rejects(
    httpFailure.request({ method: "GET", path: "/" }),
    (error) => error.statusCode === 503 && error.message === "service unavailable",
  );

  const textResponse = createInternalHttpClient({
    baseUrl: "http://service",
    fetchImpl: async () => ({
      ok: true,
      text: async () => "plain response",
    }),
  });
  assert.deepEqual(await textResponse.request({ method: "GET", path: "/" }), {
    message: "plain response",
  });

  const timeout = createInternalHttpClient({
    baseUrl: "http://service",
    fetchImpl: async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    },
  });
  await assert.rejects(
    timeout.request({ method: "GET", path: "/" }),
    (error) => error.code === "INTERNAL_SERVICE_TIMEOUT",
  );
});
