const createWorkspaceClient = ({ httpClient }) => ({
  getPaymentContext: async (requestId, correlationId) => {
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/connect-requests/${encodeURIComponent(requestId)}/payment-context`,
      correlationId,
    });
    return response.data;
  },
  updatePaymentState: async (requestId, state, correlationId) => {
    const response = await httpClient.request({
      method: "PATCH",
      path: `/internal/v1/connect-requests/${encodeURIComponent(requestId)}/payment-state`,
      body: state,
      correlationId,
    });
    return response.data;
  },
});

module.exports = createWorkspaceClient;
