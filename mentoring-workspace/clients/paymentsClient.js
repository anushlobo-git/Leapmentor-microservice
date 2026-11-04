const createPaymentsClient = ({ httpClient }) => ({
  releaseEscrow: async (connectRequestId, menteeId, correlationId) => {
    const response = await httpClient.request({
      method: "POST",
      path: "/internal/v1/escrow/release",
      body: { connectRequestId, menteeId },
      correlationId,
      idempotencyKey: `workspace-session-release:${connectRequestId}`,
    });
    return response?.data;
  },
});

module.exports = createPaymentsClient;
