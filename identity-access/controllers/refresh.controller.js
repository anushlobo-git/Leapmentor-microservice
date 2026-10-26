const createRefreshController = ({ sessionService }) => {
  const refreshToken = async (req, res, next) => {
    try {
      const result = await sessionService.refreshAccessToken(
        req.cookies?.refreshToken,
      );

      return res.status(200).json({
        success: true,
        data: result,
        message: "Access token refreshed",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { refreshToken };
};

module.exports = createRefreshController;
