const SEARCH_PROJECTION = [
  "user",
  "currentRole",
  "industry",
  "company",
  "bio",
  "profilePicture",
  "yearsOfExperience",
  "hourlyRate",
  "avgRating",
  "totalSessions",
  "skills",
  "communicationPreferences",
  "languages",
  "linkedInUrl",
  "portfolioUrl",
  "isProfileComplete",
  "isProfilePublished",
  "verificationStatus",
  "createdAt",
  "updatedAt",
].join(" ");

const createMentorSearchRepository = (MentorProfile) => {
  const countSearchable = (filter) => MentorProfile.countDocuments(filter);

  const findSearchable = (filter, { skip, limit }) =>
    MentorProfile.find(filter)
      .select(SEARCH_PROJECTION)
      .sort({ avgRating: -1, totalSessions: -1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

  return { countSearchable, findSearchable };
};

module.exports = createMentorSearchRepository;
