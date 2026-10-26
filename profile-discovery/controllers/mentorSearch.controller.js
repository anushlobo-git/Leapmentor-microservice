const createMentorSearchController = ({ mentorSearchService }) => {
  const searchMentors = async (req, res, next) => {
    try {
      const result = await mentorSearchService.queryMentors(req.query, {
        correlationId: req.correlationId,
      });
      return res.status(200).json({
        success: true,
        data: result,
        message: "Mentors retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { searchMentors };
};

module.exports = createMentorSearchController;
