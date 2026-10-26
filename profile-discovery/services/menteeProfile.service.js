const AppError = require("../utils/AppError");

const DEFAULT_LANGUAGES = ["English"];
const UPDATE_FIELDS = [
  "currentRole",
  "industry",
  "company",
  "yearsOfExperience",
  "bio",
  "profilePicture",
  "linkedInUrl",
  "portfolioUrl",
  "skills",
  "interestedFields",
  "communicationPreferences",
  "languages",
  "emailNotifications",
  "marketingPreferences",
];

const createMenteeProfileService = ({
  menteeProfileRepository,
  identityClient,
  toMenteeProfileDTO,
}) => {
  const verifyMenteeRole = async (userId, correlationId, userSummary) => {
    const user =
      userSummary || (await identityClient.getUserSummary(userId, correlationId));
    if (!user?.roles?.includes("mentee")) {
      throw new AppError("Access denied: mentee role required", 403, "ROLE_REQUIRED");
    }
    return user;
  };

  const createProfile = async (
    userId,
    data,
    { correlationId, user: userSummary } = {},
  ) => {
    await verifyMenteeRole(userId, correlationId, userSummary);
    const existing = await menteeProfileRepository.findByUserId(userId);
    if (existing) {
      throw new AppError(
        "Profile already exists. Use update instead.",
        409,
        "PROFILE_EXISTS",
      );
    }

    const profile = await menteeProfileRepository.create({
      user: userId,
      currentRole: data.currentRole,
      industry: data.industry,
      company: data.company,
      yearsOfExperience: data.yearsOfExperience || "",
      bio: data.bio,
      profilePicture: data.profilePicture || "",
      profilePictureFileName: data.profilePictureFileName || "",
      linkedInUrl: data.linkedInUrl || "",
      portfolioUrl: data.portfolioUrl || "",
      skills: data.skills || [],
      interestedFields: data.interestedFields || [],
      communicationPreferences: data.communicationPreferences || [],
      languages: data.languages || DEFAULT_LANGUAGES,
      isProfileComplete: true,
      isProfilePublished: true,
    });

    return toMenteeProfileDTO(profile);
  };

  const getMyProfile = async (
    userId,
    { correlationId, user: userSummary } = {},
  ) => {
    await verifyMenteeRole(userId, correlationId, userSummary);
    const profile = await menteeProfileRepository.findByUserIdWithAccountInfo(userId);
    if (!profile) {
      throw new AppError("Profile not found", 404, "PROFILE_NOT_FOUND");
    }
    return toMenteeProfileDTO(profile);
  };

  const updateMyProfile = async (
    userId,
    updateData,
    { correlationId, user: userSummary } = {},
  ) => {
    await verifyMenteeRole(userId, correlationId, userSummary);
    const safeUpdate = Object.fromEntries(
      UPDATE_FIELDS.filter((field) => Object.hasOwn(updateData || {}, field)).map(
        (field) => [field, updateData[field]],
      ),
    );
    const profile = await menteeProfileRepository.findOneAndUpdateByUserId(
      userId,
      safeUpdate,
    );
    if (!profile) {
      throw new AppError("Profile not found", 404, "PROFILE_NOT_FOUND");
    }
    return toMenteeProfileDTO(profile);
  };

  const getPublicProfile = async (targetUserId) => {
    const profile = await menteeProfileRepository.findPublishedByUserId(targetUserId);
    if (!profile) {
      throw new AppError(
        "Mentee profile not found",
        404,
        "PROFILE_NOT_FOUND",
      );
    }
    return toMenteeProfileDTO(profile);
  };

  return { createProfile, getMyProfile, updateMyProfile, getPublicProfile };
};

module.exports = createMenteeProfileService;
