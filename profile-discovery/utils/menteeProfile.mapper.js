const toMenteeProfileDTO = (profile, userSummary) => {
  if (!profile) return null;

  const populatedUser =
    profile.user &&
    typeof profile.user === "object" &&
    (profile.user.name || profile.user.email)
      ? profile.user
      : null;
  const account = userSummary || populatedUser;
  const userId = populatedUser?._id || profile.user;
  const accountId = account?._id || account?.id || userId;

  return {
    _id: profile._id?.toString?.() || profile._id,
    user: account
      ? {
          id: accountId?.toString?.() || accountId,
          name: account.name,
          email: account.email,
          isEmailVerified: account.isEmailVerified,
        }
      : userId?.toString?.() || userId,
    currentRole: profile.currentRole || "",
    industry: profile.industry || "",
    company: profile.company || "",
    yearsOfExperience: profile.yearsOfExperience || "",
    bio: profile.bio || "",
    profilePicture: profile.profilePicture || "",
    profilePictureFileName: profile.profilePictureFileName || "",
    linkedInUrl: profile.linkedInUrl || "",
    portfolioUrl: profile.portfolioUrl || "",
    skills: profile.skills || [],
    interestedFields: profile.interestedFields || [],
    communicationPreferences: profile.communicationPreferences || [],
    languages: profile.languages || ["English"],
    isProfileComplete: profile.isProfileComplete || false,
    isProfilePublished: profile.isProfilePublished || false,
    emailNotifications: profile.emailNotifications !== false,
    marketingPreferences: profile.marketingPreferences || false,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};

module.exports = { toMenteeProfileDTO };
