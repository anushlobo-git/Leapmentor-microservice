const createAdminProfileRepository = ({ MentorProfile, MenteeProfile }) => {
  const findProfilesByUserIds = async (userIds) => {
    const [mentorProfiles, menteeProfiles] = await Promise.all([
      MentorProfile.find({ user: { $in: userIds } }).lean(),
      MenteeProfile.find({ user: { $in: userIds } }).lean(),
    ]);

    return { mentorProfiles, menteeProfiles };
  };

  const getMentorIndustryStats = () =>
    MentorProfile.aggregate([
      { $match: { industry: { $nin: ["", null] } } },
      { $group: { _id: "$industry", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ]);

  return { findProfilesByUserIds, getMentorIndustryStats };
};

module.exports = createAdminProfileRepository;
