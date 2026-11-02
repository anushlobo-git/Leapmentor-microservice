const createIdentityAdminClient = ({ httpClient }) => {
  const listUsers = (query = {}, correlationId) => {
    const params = new URLSearchParams();
    for (const key of ["search", "role", "page", "limit", "deleted"]) {
      if (query[key] !== undefined && query[key] !== "") {
        params.set(key, String(query[key]));
      }
    }
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return httpClient.request({
      method: "GET",
      path: `/internal/v1/admin/users${suffix}`,
      correlationId,
    });
  };

  const getUser = (userId, correlationId) =>
    httpClient.request({
      method: "GET",
      path: `/internal/v1/admin/users/${encodeURIComponent(userId)}`,
      correlationId,
    });

  const getUserSummaries = (userIds, correlationId) => {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) return Promise.resolve([]);

    const params = new URLSearchParams({ ids: ids.join(",") });
    return httpClient
      .request({
        method: "GET",
        path: `/internal/v1/users?${params.toString()}`,
        correlationId,
      })
      .then((response) => response?.data?.users || []);
  };

  const setBlocked = (userId, blocked, correlationId) =>
    httpClient.request({
      method: "PATCH",
      path: `/internal/v1/admin/users/${encodeURIComponent(userId)}/${blocked ? "block" : "unblock"}`,
      correlationId,
    });

  const getStats = (correlationId) =>
    httpClient.request({ method: "GET", path: "/internal/v1/admin/stats", correlationId });

  const getUserGrowth = (days, correlationId) =>
    httpClient.request({
      method: "GET",
      path: `/internal/v1/admin/user-growth?days=${encodeURIComponent(days || 90)}`,
      correlationId,
    });

  return {
    listUsers,
    getUser,
    getUserSummaries,
    blockUser: (userId, correlationId) => setBlocked(userId, true, correlationId),
    unblockUser: (userId, correlationId) => setBlocked(userId, false, correlationId),
    getStats,
    getUserGrowth,
  };
};

module.exports = createIdentityAdminClient;
