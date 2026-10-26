const createInternalAdminStatsController = ({ userRepository }) => {
  const getStats = async (_req, res, next) => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        totalUsers,
        totalMentors,
        totalMentees,
        newUsersThisMonth,
        newMentorsThisMonth,
        newMenteesThisMonth,
      ] = await Promise.all([
        userRepository.countAdminUsers(),
        userRepository.countAdminUsers({ roles: "mentor" }),
        userRepository.countAdminUsers({ roles: "mentee" }),
        userRepository.countAdminUsers({ createdAt: { $gte: startOfMonth } }),
        userRepository.countAdminUsers({ roles: "mentor", createdAt: { $gte: startOfMonth } }),
        userRepository.countAdminUsers({ roles: "mentee", createdAt: { $gte: startOfMonth } }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          totalUsers,
          totalMentors,
          totalMentees,
          newUsersThisMonth,
          newMentorsThisMonth,
          newMenteesThisMonth,
        },
        message: "Platform stats retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getUserGrowth = async (req, res, next) => {
    try {
      const days = Math.min(Math.max(Number(req.query.days || 90), 1), 365);
      const since = new Date();
      since.setDate(since.getDate() - days);
      const growth = await userRepository.getAdminUserGrowth(since);

      return res.status(200).json({
        success: true,
        data: growth.map((item) => ({
          label: new Date(`${item._id}T00:00:00Z`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }),
          count: item.count,
        })),
        message: "User growth data retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getStats, getUserGrowth };
};

module.exports = createInternalAdminStatsController;
