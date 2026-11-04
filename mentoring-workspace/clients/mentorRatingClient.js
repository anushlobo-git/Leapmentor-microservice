const createMentorRatingClient = ({ httpClient }) => {
  const updateAverageRating = (mentorId, avgRating, correlationId) =>
    httpClient.request({
      method: "PUT",
      path: `/internal/v1/mentors/${encodeURIComponent(mentorId)}/rating`,
      body: { avgRating },
      correlationId,
    });

  return { updateAverageRating };
};

module.exports = createMentorRatingClient;
