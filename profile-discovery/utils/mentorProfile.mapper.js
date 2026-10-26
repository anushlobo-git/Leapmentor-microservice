const toMentorProfileDTO = (profile) => {
  if (!profile) return null;

  return {
    _id: profile._id?.toString?.() || profile._id,
    user: profile.user?._id
      ? {
          _id: profile.user._id.toString(),
          name: profile.user.name,
          email: profile.user.email,
        }
      : profile.user?.toString?.() || profile.user,
    currentRole: profile.currentRole || "",
    industry: profile.industry || "",
    company: profile.company || "",
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
