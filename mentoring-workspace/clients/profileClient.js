const createProfileClient = ({ httpClient }) => ({
  getMentorRating: async (mentorId, correlationId) => {
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/mentors/${encodeURIComponent(mentorId)}/rating`,
      correlationId,
    });
    return response?.data || { userId: mentorId, avgRating: 0 };
  },
  getSimilarMentors: async (mentorId, correlationId) => {
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/mentors/${encodeURIComponent(mentorId)}/similar`,
      correlationId,
    });
    return response?.data || { mentors: [], mySkills: [] };
  },
  getMentorAvailability: async (
    mentorId,
    duration,
    excludeUserId,
    correlationId,
    requestId,
  ) => {
    const params = new URLSearchParams({
      duration: String(duration),
      excludeUserId: excludeUserId || "",
    });
    if (requestId) params.set("requestId", requestId);
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/mentors/${encodeURIComponent(mentorId)}/availability?${params}`,
      correlationId,
    });
    return response?.data;
  },
});

module.exports = createProfileClient;
