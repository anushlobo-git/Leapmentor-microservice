const CACHE_TTL_SECONDS = 300;

const createDashboardService = ({ identityClient, profileClient, workspaceClient, cache }) => {
  const cached = (key, factory) => cache.getOrSet(key, CACHE_TTL_SECONDS, factory);

  const getStats = (correlationId) =>
    cached("admin:telemetry:stats", async () => (await identityClient.getStats(correlationId)).data);

  const getUserGrowth = (days, correlationId) =>
    cached(`admin:telemetry:growth:${days || 90}`, async () =>
      (await identityClient.getUserGrowth(days, correlationId)).data,
    );

  const getMentorIndustryStats = (correlationId) =>
    cached("admin:telemetry:industries", async () =>
      (await profileClient.getMentorIndustryStats(correlationId)).data,
    );

  const getEngagementStats = (correlationId) =>
    cached("admin:telemetry:engagements", async () =>
      (await workspaceClient.getEngagementStats(correlationId)).data,
    );

  return { getStats, getUserGrowth, getMentorIndustryStats, getEngagementStats };
};

module.exports = createDashboardService;
