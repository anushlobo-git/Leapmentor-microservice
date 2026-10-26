const toMentorSearchDTO = (profile, user) => ({
  _id: profile._id?.toString?.() || profile._id,
  user: {
    _id: user?._id?.toString?.() || user?._id || profile.user?.toString?.() || profile.user,
    name: user?.name || "",
    email: user?.email || "",
  },
  currentRole: profile.currentRole || "",
  industry: profile.industry || "",
  company: profile.company || "",
  bio: profile.bio || "",
  profilePicture: profile.profilePicture || "",
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
  verificationStatus: profile.verificationStatus || "unverified",
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
});

module.exports = { toMentorSearchDTO };
