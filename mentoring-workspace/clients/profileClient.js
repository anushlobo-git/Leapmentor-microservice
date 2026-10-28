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
  ) => {
    const response = await httpClient.request({
      method: "GET",
      path: `/internal/v1/mentors/${encodeURIComponent(mentorId)}/availability?duration=${encodeURIComponent(duration)}&excludeUserId=${encodeURIComponent(excludeUserId || "")}`,
      correlationId,
    });
    return response?.data;
  },
});

module.exports = createProfileClient;
