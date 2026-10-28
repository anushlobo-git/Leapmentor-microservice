// services/mentoring-workspace/clients/identityClient.js

/**
 * REST client for the Identity & Access internal user lookups.
 * See migration-docs/contracts/rest/profile-identity-user-search.md.
 */
const createIdentityClient = ({ httpClient }) => {
  const getUserSummaries = async (userIds, correlationId) => {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    if (ids.length === 0) return [];

    const params = new URLSearchParams({ ids: ids.join(",") });
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/users?${params.toString()}`,
      correlationId,
    });
    return response?.data?.users || [];
  };

  // Same lookup, keyed by user ID, for decorating a list in one pass.
  const getUserSummaryMap = async (userIds, correlationId) => {
    const users = await getUserSummaries(userIds, correlationId);
    return new Map(users.map((user) => [String(user._id), user]));
  };

  const searchUserSummaries = async (name, role, correlationId) => {
    const params = new URLSearchParams({ name, role });
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/users?${params.toString()}`,
      correlationId,
    });
    return response?.data?.users || [];
  };

  return { getUserSummaries, getUserSummaryMap, searchUserSummaries };
};

module.exports = createIdentityClient;
