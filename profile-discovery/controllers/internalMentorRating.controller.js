const createInternalMentorRatingController = ({ mentorProfileRepository }) => {
  const updateRating = async (req, res, next) => {
    try {
      const profile = await mentorProfileRepository.updateAverageRating(
        req.params.userId,
        req.body.avgRating,
      );
      if (!profile) {
        const error = new Error("Mentor profile not found");
        error.statusCode = 404;
        error.code = "MENTOR_PROFILE_NOT_FOUND";
        throw error;
      }
      return res.status(200).json({
        success: true,
        data: { userId: req.params.userId, avgRating: profile.avgRating },
        message: "Mentor rating updated",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { updateRating };
};

module.exports = createInternalMentorRatingController;
