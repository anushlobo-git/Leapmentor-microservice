const createMenteeProfileRepository = (MenteeProfile) => {
  const findByUserId = (userId) => MenteeProfile.findOne({ user: userId });

  const findByUserIdWithAccountInfo = (userId) =>
    MenteeProfile.findOne({ user: userId }).populate(
      "user",
      "name email isEmailVerified",
    );

  const findPublishedByUserId = (userId) =>
    MenteeProfile.findOne({ user: userId, isProfilePublished: true }).populate(
      "user",
      "name email",
    );

  const create = (profileData) => MenteeProfile.create(profileData);

  const findOneAndUpdateByUserId = (userId, updateData) =>
    MenteeProfile.findOneAndUpdate(
      { user: userId },
      { $set: updateData },
      { new: true, runValidators: true },
    );

  return {
    findByUserId,
    findByUserIdWithAccountInfo,
    findPublishedByUserId,
    create,
    findOneAndUpdateByUserId,
  };
};

module.exports = createMenteeProfileRepository;
