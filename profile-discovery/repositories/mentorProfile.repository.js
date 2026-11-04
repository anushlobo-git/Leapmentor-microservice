const createMentorProfileRepository = (MentorProfile) => {
  const findMentorProfileByUserId = (userId) =>
    MentorProfile.findOne({ user: userId }).lean();

  const findAllMentorProfilesForAdmin = () =>
    MentorProfile.find({})
      .sort({ createdAt: -1 })
      .lean();

  const findMentorProfileByIdForAdmin = (id) =>
    MentorProfile.findById(id).lean();

  const findMentorProfileByIdForAdminMutable = (id) =>
    MentorProfile.findById(id);

  const findPublishedByUserId = (userId) =>
    MentorProfile.findOne({
      user: userId,
      isProfilePublished: { $ne: false },
    });

  const create = (profileData) => MentorProfile.create(profileData);

  const findOneAndUpdateByUserId = (userId, updateData) =>
    MentorProfile.findOneAndUpdate(
      { user: userId },
      { $set: updateData },
      { new: true, runValidators: true },
    );

  const updateAverageRating = (userId, avgRating) =>
    MentorProfile.findOneAndUpdate(
      { user: userId },
      { $set: { avgRating } },
      { new: true, runValidators: true },
    ).lean();

  const findSimilarPublishedMentors = (userId, skills, limit = 20) =>
    MentorProfile.find({
      user: { $ne: userId },
      isProfilePublished: { $ne: false },
      isProfileComplete: true,
      skills: { $in: skills },
    })
      .select("user currentRole industry company bio profilePicture yearsOfExperience hourlyRate avgRating totalSessions skills communicationPreferences languages linkedInUrl portfolioUrl isProfileComplete isProfilePublished verificationStatus createdAt updatedAt")
      .sort({ avgRating: -1, totalSessions: -1, _id: 1 })
      .limit(limit)
      .lean();

  const saveMentorProfile = (profile) => profile.save();

  return {
    findMentorProfileByUserId,
    findAllMentorProfilesForAdmin,
    findMentorProfileByIdForAdmin,
    findMentorProfileByIdForAdminMutable,
    findPublishedByUserId,
    create,
    findOneAndUpdateByUserId,
    updateAverageRating,
    findSimilarPublishedMentors,
    saveMentorProfile,
  };
};

module.exports = createMentorProfileRepository;
