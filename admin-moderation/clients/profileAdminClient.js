const createProfileAdminClient = ({ httpClient }) => ({
  getProfiles: (userIds, correlationId) =>
    httpClient.request({
      method: "GET",
      path: `/internal/v1/admin/profiles?ids=${userIds.map(encodeURIComponent).join(",")}`,
      correlationId,
    }),
  getMentorIndustryStats: (correlationId) =>
    httpClient.request({
      method: "GET",
      path: "/internal/v1/admin/stats/mentor-industries",
      correlationId,
    }),
  listMentorVerifications: (correlationId) =>
    httpClient.request({
      method: "GET",
      path: "/internal/v1/admin/mentor-verifications",
      correlationId,
    }),
  getMentorVerification: (mentorProfileId, correlationId) =>
    httpClient.request({
      method: "GET",
      path: `/internal/v1/admin/mentor-verifications/${encodeURIComponent(mentorProfileId)}`,
      correlationId,
    }),
  verifyMentor: (mentorProfileId, correlationId) =>
    httpClient.request({
      method: "PATCH",
      path: `/internal/v1/admin/mentor-verifications/${encodeURIComponent(mentorProfileId)}/verify`,
      correlationId,
    }),
  revokeMentor: (mentorProfileId, correlationId) =>
    httpClient.request({
      method: "PATCH",
      path: `/internal/v1/admin/mentor-verifications/${encodeURIComponent(mentorProfileId)}/revoke`,
      correlationId,
    }),
});

module.exports = createProfileAdminClient;
