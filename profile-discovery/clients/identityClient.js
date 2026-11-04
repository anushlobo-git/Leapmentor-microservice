const createIdentityClient = ({ httpClient }) => ({
  getUserSummary: async (userId, correlationId) => {
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/users/${encodeURIComponent(userId)}`,
      correlationId,
    });
    return response.data;
  },
  searchUsers: async ({ name, role }, correlationId) => {
    const params = new URLSearchParams({ name, role });
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/users?${params.toString()}`,
      correlationId,
    });
    return response.data?.users || [];
  },
  getUserSummaries: async (userIds, correlationId) => {
    if (!userIds.length) return [];
    const params = new URLSearchParams({ ids: userIds.join(",") });
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/users?${params.toString()}`,
      correlationId,
    });
    return response.data?.users || [];
  },
});

module.exports = createIdentityClient;
