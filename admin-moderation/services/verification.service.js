const normalizeMentor = (entry) => {
  if (!entry) return null;
  if (entry.mentorProfile) return entry;

  const { user, ...mentorProfile } = entry;
  return {
    user,
    mentorProfile,
  };
};

const createVerificationService = ({ profileClient }) => ({
  list: async (correlationId) => {
    const response = await profileClient.listMentorVerifications(correlationId);
    const data = response?.data || {};
    const mentors = Array.isArray(data.mentors)
      ? data.mentors.map(normalizeMentor).filter(Boolean)
      : [];
    return { ...data, mentors, total: data.total ?? mentors.length };
  },
  getById: async (mentorProfileId, correlationId) => {
    const response = await profileClient.getMentorVerification(
      mentorProfileId,
      correlationId,
    );
    const data = response?.data;
    if (!data) return null;
    return data.mentor ? { ...data, mentor: normalizeMentor(data.mentor) } : normalizeMentor(data);
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
