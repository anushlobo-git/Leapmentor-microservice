const CACHE_TTL_SECONDS = 300;

const createDashboardService = ({
  identityClient,
  profileClient,
  workspaceClient,
  cache,
}) => {
  const cached = (key, factory) =>
    cache.getOrSet(key, CACHE_TTL_SECONDS, factory);

  const getStats = (correlationId) =>
    cached(
      "admin:telemetry:stats",
      async () => (await identityClient.getStats(correlationId)).data,
    );

  const getUserGrowth = (days, correlationId) =>
    cached(
      `admin:telemetry:growth:${days || 90}`,
      async () =>
        (await identityClient.getUserGrowth(days, correlationId)).data,
    );

  const getMentorIndustryStats = (correlationId) =>
    cached(
      "admin:telemetry:industries",
      async () =>
        (await profileClient.getMentorIndustryStats(correlationId)).data,
    );

  const getEngagementStats = (correlationId) =>
    cached(
      "admin:telemetry:engagements",
      async () =>
        (await workspaceClient.getEngagementStats(correlationId)).data,
    );

  const getEngagements = async (query = {}, correlationId) => {
    let matchingUsers = [];
    if (query.search?.trim()) {
      const usersResponse = await identityClient.listUsers(
        { search: query.search.trim(), page: 1, limit: 100 },
        correlationId,
      );
      matchingUsers = usersResponse?.data?.users || [];
      if (matchingUsers.length === 0) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 15;
        return {
          engagements: [],
          pagination: { total: 0, page, totalPages: 0 },
        };
      }
    }

    const response = await workspaceClient.getEngagements(
      {
        ...query,
        userIds: query.search?.trim()
          ? matchingUsers.map((user) => String(user._id)).join(",")
          : undefined,
      },
      correlationId,
    );
    const data = response?.data || {};
    const usersById = new Map(
      matchingUsers.map((user) => [String(user._id), user]),
    );
    const participants = new Set(
      (data.engagements || []).flatMap((engagement) =>
        [engagement.mentor, engagement.mentee]
          .map((participant) => String(participant?._id || participant || ""))
          .filter(Boolean),
      ),
    );
    await Promise.all(
      [...participants].map(async (userId) => {
        if (usersById.has(userId)) return;
        try {
          const userResponse = await identityClient.getUser(
            userId,
            correlationId,
          );
          const user = userResponse?.data?.user;
          if (user) usersById.set(userId, user);
        } catch {
          usersById.set(userId, { _id: userId, name: "-", email: "-" });
        }
      }),
    );

    return {
      ...data,
      engagements: (data.engagements || []).map((engagement) => {
        const participant = (value) => {
          const userId = String(value?._id || value || "");
          return (
            usersById.get(userId) || { _id: userId, name: "-", email: "-" }
          );
        };
        return {
          ...engagement,
          mentor: participant(engagement.mentor),
          mentee: participant(engagement.mentee),
        };
      }),
    };
  };

  return {
    getStats,
    getUserGrowth,
    getMentorIndustryStats,
    getEngagementStats,
    getEngagements,
  };
};

module.exports = createDashboardService;
