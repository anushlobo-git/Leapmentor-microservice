const createWorkspaceClient = ({ httpClient }) => ({
  queueEmailEvent: async (event, correlationId) => {
    const response = await httpClient.request({
      method: "POST",
      path: "/internal/v1/finance/email-events",
      body: event,
      correlationId,
      idempotencyKey: event.sourceEventId,
    });
    return response.data;
  },
  getSlotBlockers: async (
    mentorId,
    excludeUserId,
    correlationId,
    requestId,
  ) => {
    const params = new URLSearchParams({ excludeUserId: excludeUserId || "" });
    if (requestId) params.set("requestId", requestId);
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/availability/blockers/${encodeURIComponent(mentorId)}?${params}`,
      correlationId,
    });
    return response.data;
  },
});

module.exports = createWorkspaceClient;
