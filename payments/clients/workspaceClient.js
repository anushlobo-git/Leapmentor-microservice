const createWorkspaceClient = ({ httpClient }) => ({
  queueInvoiceEmail: async (event, correlationId) => {
    const response = await httpClient.request({
      method: "POST",
      path: "/internal/v1/finance/invoice-email",
      body: event,
      correlationId,
      idempotencyKey: event.sourceEventId,
    });
    return response.data;
  },
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
  getInvoiceContext: async (requestId, correlationId) => {
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/finance/invoices/${encodeURIComponent(requestId)}`,
      correlationId,
    });
    return response.data;
  },
  getMentorSessions: async (
    mentorId,
    { status = "completed", since } = {},
    correlationId,
  ) => {
    const params = new URLSearchParams({ status });
    if (since) params.set("since", since.toISOString());
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/finance/mentors/${encodeURIComponent(mentorId)}/sessions?${params}`,
      correlationId,
    });
    return response.data.sessions;
  },
  getMentorPayouts: async (mentorId, query = {}, correlationId) => {
    const params = new URLSearchParams();
    for (const key of ["page", "limit", "search"]) {
      if (query[key] !== undefined && query[key] !== "")
        params.set(key, String(query[key]));
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/finance/mentors/${encodeURIComponent(mentorId)}/payouts${suffix}`,
      correlationId,
    });
    return response.data;
  },
  getMentorRating: async (mentorId, correlationId) => {
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/finance/mentors/${encodeURIComponent(mentorId)}/rating`,
      correlationId,
    });
    return response.data;
  },
  getPaymentContext: async (requestId, correlationId) => {
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/connect-requests/${encodeURIComponent(requestId)}/payment-context`,
      correlationId,
    });
    return response.data;
  },
  createAdditionalSlot: async (requestId, slot, menteeId, correlationId) => {
    const response = await httpClient.request({
      method: "POST",
      path: `/internal/v1/connect-requests/${encodeURIComponent(requestId)}/additional-slots`,
      body: { ...slot, userId: menteeId },
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
