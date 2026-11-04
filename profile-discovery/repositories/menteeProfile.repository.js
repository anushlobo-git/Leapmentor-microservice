const createMenteeProfileRepository = (MenteeProfile) => {
  const findByUserId = (userId) => MenteeProfile.findOne({ user: userId });

  const findPublishedByUserId = (userId) =>
    MenteeProfile.findOne({ user: userId, isProfilePublished: true });

  const create = (profileData) => MenteeProfile.create(profileData);

  const findOneAndUpdateByUserId = (userId, updateData) =>
    MenteeProfile.findOneAndUpdate(
      { user: userId },
      { $set: updateData },
      { new: true, runValidators: true },
    );

  return {
    findByUserId,
    findPublishedByUserId,
    create,
    findOneAndUpdateByUserId,
  };
};

module.exports = createMenteeProfileRepository;
