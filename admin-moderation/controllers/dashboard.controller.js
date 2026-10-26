const createDashboardController = ({ dashboardService }) => {
  const getStats = async (req, res, next) => {
    try {
      return res.status(200).json({
        success: true,
        data: await dashboardService.getStats(req.correlationId),
        message: "Platform stats retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getUserGrowth = async (req, res, next) => {
    try {
      return res.status(200).json({
        success: true,
        data: await dashboardService.getUserGrowth(req.query.days, req.correlationId),
        message: "User growth data retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getMentorIndustryStats = async (req, res, next) => {
    try {
      return res.status(200).json({
        success: true,
        data: await dashboardService.getMentorIndustryStats(req.correlationId),
        message: "Mentor industry stats retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getEngagementStats = async (req, res, next) => {
    try {
      return res.status(200).json({
        success: true,
        data: await dashboardService.getEngagementStats(req.correlationId),
        message: "Engagement stats retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getStats, getUserGrowth, getMentorIndustryStats, getEngagementStats };
};

module.exports = createDashboardController;
