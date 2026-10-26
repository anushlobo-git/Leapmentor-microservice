const toMenteeProfileDTO = (profile) => {
  if (!profile) return null;

  return {
    _id: profile._id?.toString?.() || profile._id,
    user: profile.user?._id
      ? {
          id: profile.user._id.toString(),
          name: profile.user.name,
          email: profile.user.email,
          isEmailVerified: profile.user.isEmailVerified,
        }
      : profile.user?.toString?.() || profile.user,
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
