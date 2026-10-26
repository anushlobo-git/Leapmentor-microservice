const createWorkspaceClient = ({ httpClient }) => ({
  getSlotBlockers: async (mentorId, excludeUserId, correlationId) => {
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/availability/blockers/${encodeURIComponent(
        mentorId,
      )}?excludeUserId=${encodeURIComponent(excludeUserId || "")}`,
      correlationId,
    });
    return response.data;
  },
});

module.exports = createWorkspaceClient;
