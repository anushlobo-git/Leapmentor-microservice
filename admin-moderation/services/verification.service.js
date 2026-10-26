const createVerificationService = ({ profileClient }) => ({
  list: async (correlationId) => {
    const response = await profileClient.listMentorVerifications(correlationId);
    return response?.data || { mentors: [], total: 0 };
  },
  getById: async (mentorProfileId, correlationId) => {
    const response = await profileClient.getMentorVerification(mentorProfileId, correlationId);
    return response?.data || null;
  },
  verify: async (mentorProfileId, correlationId) => {
    const response = await profileClient.verifyMentor(mentorProfileId, correlationId);
    return response?.data || null;
  },
  revoke: async (mentorProfileId, correlationId) => {
    const response = await profileClient.revokeMentor(mentorProfileId, correlationId);
    return response?.data || null;
  },
});

module.exports = createVerificationService;
