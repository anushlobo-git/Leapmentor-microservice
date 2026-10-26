const STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "referred",
  "ongoing",
  "completed",
];

const createInternalAdminStatsController = ({ connectRequestRepository }) => {
  const getEngagementStats = async (_req, res, next) => {
    try {
      const counts = await Promise.all(
        STATUSES.map((status) => connectRequestRepository.countByStatus(status)),
      );
      const data = Object.fromEntries(STATUSES.map((status, index) => [status, counts[index]]));
      data.total = counts.reduce((total, count) => total + count, 0);

      return res.status(200).json({
        success: true,
        data,
        message: "Engagement stats retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getEngagementStats };
};

module.exports = createInternalAdminStatsController;
