const createPaymentsAdminClient = ({ httpClient }) => ({
  getCommission: (correlationId) =>
    httpClient.request({
      method: "GET",
      path: "/internal/v1/settings/commission",
      correlationId,
    }),
  updateCommission: (commissionRate, correlationId) =>
    httpClient.request({
      method: "PUT",
      path: "/internal/v1/settings/commission",
      body: { commissionRate },
      correlationId,
    }),
  refund: (requestId, correlationId) =>
    httpClient.request({
      method: "POST",
      path: "/internal/v1/refunds",
      body: { requestId },
      correlationId,
    }),
  listLeapRequests: (status, correlationId) => {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    return httpClient.request({
      method: "GET",
      path: `/internal/v1/leap-requests${suffix}`,
      correlationId,
    });
  },
  getPendingLeapRequestCount: (correlationId) =>
    httpClient.request({
      method: "GET",
      path: "/internal/v1/leap-requests/pending-count",
      correlationId,
    }),
  approveLeapRequest: (requestId, adminId, correlationId) =>
    httpClient.request({
      method: "PATCH",
      path: `/internal/v1/leap-requests/${encodeURIComponent(requestId)}/approve`,
      body: { adminId },
      correlationId,
    }),
  rejectLeapRequest: (requestId, adminId, correlationId) =>
    httpClient.request({
      method: "PATCH",
      path: `/internal/v1/leap-requests/${encodeURIComponent(requestId)}/reject`,
      body: { adminId },
      correlationId,
    }),
  getAdminPaymentSummary: (correlationId) =>
    httpClient.request({
      method: "GET",
      path: "/internal/v1/admin/payments/summary",
      correlationId,
    }),
  getAdminPaymentTransactions: (query = {}, correlationId) => {
    const params = new URLSearchParams();
    for (const key of ["page", "limit", "type", "userIds"]) {
      if (query[key] !== undefined && query[key] !== "")
        params.set(key, String(query[key]));
    }
    const suffix = params.toString() ? `?${params}` : "";
    return httpClient.request({
      method: "GET",
      path: `/internal/v1/admin/payments/transactions${suffix}`,
      correlationId,
    });
  },
});

module.exports = createPaymentsAdminClient;
