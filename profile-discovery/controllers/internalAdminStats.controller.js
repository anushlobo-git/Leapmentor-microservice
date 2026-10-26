const createInternalAdminStatsController = ({ adminProfileRepository }) => {
  const getMentorIndustryStats = async (_req, res, next) => {
    try {
      const industries = await adminProfileRepository.getMentorIndustryStats();
      return res.status(200).json({
        success: true,
        data: industries.map((item) => ({ industry: item._id, count: item.count })),
        message: "Mentor industry stats retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getMentorIndustryStats };
};

module.exports = createInternalAdminStatsController;
