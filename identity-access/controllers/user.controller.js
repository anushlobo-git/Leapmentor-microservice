const createUserController = ({ authService, userService }) => {
  const getMe = async (req, res, next) => {
    try {
      const currentUser = userService.getCurrentUser(req.user);
      return res.status(200).json({
        success: true,
        data: currentUser,
        message: "Current user",
      });
    } catch (error) {
      return next(error);
    }
  };

  const addRole = async (req, res, next) => {
    try {
      const updatedUser = await authService.addAccountRole(
        req.user,
        req.body.role,
        { correlationId: req.correlationId },
      );

      return res.status(200).json({
        success: true,
        data: updatedUser,
        message: `"${req.body.role}" role added to your account.`,
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getMe, addRole };
};

module.exports = createUserController;
