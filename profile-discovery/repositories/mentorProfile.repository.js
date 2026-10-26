const createMentorProfileRepository = (MentorProfile) => {
  const findMentorProfileByUserId = (userId) =>
    MentorProfile.findOne({ user: userId }).lean();

  const findMentorProfileByUserIdWithUser = (userId) =>
    MentorProfile.findOne({ user: userId }).populate(
      "user",
      "name email isEmailVerified",
    );

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
    }).populate("user", "name email");

  const create = (profileData) => MentorProfile.create(profileData);

  const findOneAndUpdateByUserId = (userId, updateData) =>
    MentorProfile.findOneAndUpdate(
      { user: userId },
      { $set: updateData },
      { new: true, runValidators: true },
    );

  const saveMentorProfile = (profile) => profile.save();

  return {
    findMentorProfileByUserId,
    findMentorProfileByUserIdWithUser,
    findAllMentorProfilesForAdmin,
    findMentorProfileByIdForAdmin,
    findMentorProfileByIdForAdminMutable,
    findPublishedByUserId,
    create,
    findOneAndUpdateByUserId,
    saveMentorProfile,
  };
};

module.exports = createMentorProfileRepository;
