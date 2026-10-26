const createWorkspaceAdminClient = ({ httpClient }) => ({
  getCompletedSessionCount: (userId, correlationId) =>
    httpClient.request({
      method: "GET",
      path: `/internal/v1/admin/users/${encodeURIComponent(userId)}/completed-session-count`,
      correlationId,
    }),
  getEngagementStats: (correlationId) =>
    httpClient.request({
      method: "GET",
      path: "/internal/v1/admin/engagements/stats",
      correlationId,
    }),
  getReportStats: (correlationId) =>
    httpClient.request({
      method: "GET",
      path: "/internal/v1/admin/reports/stats",
      correlationId,
    }),
  listReports: (query = {}, correlationId) => {
    const params = new URLSearchParams();
    for (const key of ["status", "page", "limit"]) {
      if (query[key] !== undefined && query[key] !== "") params.set(key, String(query[key]));
    }
    const suffix = params.toString() ? `?${params}` : "";
    return httpClient.request({ method: "GET", path: `/internal/v1/admin/reports${suffix}`, correlationId });
  },
  getReport: (reportId, correlationId) =>
    httpClient.request({ method: "GET", path: `/internal/v1/admin/reports/${encodeURIComponent(reportId)}`, correlationId }),
  updateReport: (reportId, body, correlationId) =>
    httpClient.request({ method: "PATCH", path: `/internal/v1/admin/reports/${encodeURIComponent(reportId)}`, body, correlationId }),
  deleteSession: (reportId, body, correlationId) =>
    httpClient.request({ method: "DELETE", path: `/internal/v1/admin/reports/${encodeURIComponent(reportId)}/session`, body, correlationId }),
});

module.exports = createWorkspaceAdminClient;
