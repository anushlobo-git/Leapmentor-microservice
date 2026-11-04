const mongoose = require("mongoose");

const createInternalAdminUserController = ({ connectRequestRepository }) => {
  const getCompletedSessionCount = async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
        return res.status(400).json({
          error: "Invalid user id",
          code: "INVALID_USER_ID",
        });
      }

      const sessionCount =
        await connectRequestRepository.countCompletedSessionsByUser(
          req.params.userId,
        );

      return res.status(200).json({
        success: true,
        data: { sessionCount },
        message: "Completed session count retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getCompletedSessionCount };
};

module.exports = createInternalAdminUserController;
