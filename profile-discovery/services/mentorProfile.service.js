const AppError = require("../utils/AppError");

const DEFAULT_YEARS_OF_EXPERIENCE = 0;
const DEFAULT_HOURLY_RATE = 0;
const DEFAULT_LANGUAGES = ["English"];
const UPDATE_FIELDS = [
  "currentRole",
  "industry",
  "company",
  "bio",
  "profilePicture",
  "yearsOfExperience",
  "hourlyRate",
  "skills",
  "communicationPreferences",
  "languages",
  "linkedInUrl",
  "portfolioUrl",
];

const createMentorProfileService = ({
  mentorProfileRepository,
  identityClient,
  toMentorProfileDTO,
}) => {
  const verifyMentorRole = async (userId, correlationId, userSummary) => {
    const user =
      userSummary || (await identityClient.getUserSummary(userId, correlationId));
    if (!user?.roles?.includes("mentor")) {
      throw new AppError("Access denied: mentor role required", 403, "ROLE_REQUIRED");
    }
    return user;
  };

  const createProfile = async (
    userId,
    data,
    { correlationId, user: userSummary } = {},
  ) => {
    await verifyMentorRole(userId, correlationId, userSummary);
    const existing = await mentorProfileRepository.findMentorProfileByUserId(userId);
    if (existing) {
      throw new AppError("Profile already exists. Use update instead.", 409, "PROFILE_EXISTS");
    }

    const profile = await mentorProfileRepository.create({
      user: userId,
      currentRole: data.currentRole,
      industry: data.industry,
      company: data.company,
      bio: data.bio,
      profilePicture: data.profilePicture || "",
      profilePictureFileName: data.profilePictureFileName || "",
      yearsOfExperience: data.yearsOfExperience ?? DEFAULT_YEARS_OF_EXPERIENCE,
      hourlyRate: data.hourlyRate ?? DEFAULT_HOURLY_RATE,
      skills: data.skills || [],
      communicationPreferences: data.communicationPreferences || [],
      languages: data.languages || DEFAULT_LANGUAGES,
      linkedInUrl: data.linkedInUrl || "",
      portfolioUrl: data.portfolioUrl || "",
      isProfileComplete: true,
      isProfilePublished: true,
    });

    return toMentorProfileDTO(profile);
  };

  const getMyProfile = async (
    userId,
    { correlationId, user: userSummary } = {},
  ) => {
    await verifyMentorRole(userId, correlationId, userSummary);
    const profile = await mentorProfileRepository.findMentorProfileByUserIdWithUser(userId);
    if (!profile) throw new AppError("Profile not found", 404, "PROFILE_NOT_FOUND");
    return toMentorProfileDTO(profile);
  };

  const updateMyProfile = async (
    userId,
    updateData,
    { correlationId, user: userSummary } = {},
  ) => {
    await verifyMentorRole(userId, correlationId, userSummary);
    const safeUpdate = Object.fromEntries(
      UPDATE_FIELDS.filter((field) => Object.hasOwn(updateData || {}, field)).map(
        (field) => [field, updateData[field]],
      ),
    );
    const profile = await mentorProfileRepository.findOneAndUpdateByUserId(
      userId,
      safeUpdate,
    );
    if (!profile) throw new AppError("Profile not found", 404, "PROFILE_NOT_FOUND");
    return toMentorProfileDTO(profile);
  };

  const getPublicProfile = async (targetUserId) => {
    const profile = await mentorProfileRepository.findPublishedByUserId(targetUserId);
    if (!profile) {
      throw new AppError("Mentor profile not found", 404, "PROFILE_NOT_FOUND");
    }
    return toMentorProfileDTO(profile);
  };

  return { createProfile, getMyProfile, updateMyProfile, getPublicProfile };
};

module.exports = createMentorProfileService;
