const toMentorProfileDTO = (profile, userSummary) => {
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
          _id: accountId?.toString?.() || accountId,
          name: account.name,
          email: account.email,
        }
      : userId?.toString?.() || userId,
    currentRole: profile.currentRole || "",
    industry: profile.industry || "",
    company: profile.company || "",
    education: profile.education || "",
    bio: profile.bio || "",
    profilePicture: profile.profilePicture || "",
    profilePictureFileName: profile.profilePictureFileName || "",
    yearsOfExperience: profile.yearsOfExperience ?? 0,
    hourlyRate: profile.hourlyRate ?? 0,
    avgRating: profile.avgRating ?? 0,
    totalSessions: profile.totalSessions ?? 0,
    skills: profile.skills || [],
    communicationPreferences: profile.communicationPreferences || [],
    languages: profile.languages || ["English"],
    linkedInUrl: profile.linkedInUrl || "",
    portfolioUrl: profile.portfolioUrl || "",
    isProfileComplete: profile.isProfileComplete || false,
    isProfilePublished: profile.isProfilePublished !== false,
    emailNotifications: profile.emailNotifications !== false,
    verificationStatus: profile.verificationStatus || "unverified",
    phoneNumber: profile.phoneNumber || "",
    resumeDocument: profile.resumeDocument || null,
    workExperienceDocuments: profile.workExperienceDocuments || [],
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
};

module.exports = { toMentorProfileDTO };
