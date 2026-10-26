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
});

module.exports = createPaymentsAdminClient;
