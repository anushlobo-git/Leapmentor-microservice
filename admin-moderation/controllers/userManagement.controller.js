const createUserManagementController = ({ userManagementService }) => {
  const getUsers = async (req, res, next) => {
    try {
      const data = await userManagementService.getUsers(
        req.query,
        req.correlationId,
      );
      return res.status(200).json({ success: true, data, message: "Users retrieved" });
    } catch (error) {
      return next(error);
    }
  };

  const getUserDetail = async (req, res, next) => {
    try {
      const data = await userManagementService.getUserDetail(
        req.params.userId,
        req.correlationId,
      );
      return res.status(200).json({ success: true, data, message: "User details retrieved" });
    } catch (error) {
      return next(error);
    }
  };

  const setBlocked = (blocked) => async (req, res, next) => {
    try {
      const result = blocked
        ? await userManagementService.blockUser(req.params.userId, req.correlationId)
        : await userManagementService.unblockUser(req.params.userId, req.correlationId);
      return res.status(200).json({
        success: true,
        data: { user: result.user },
        message: blocked
          ? `User ${result.name} has been blocked.`
          : `User ${result.name} has been restored.`,
      });
    } catch (error) {
      return next(error);
    }
  };

  return {
    getUsers,
    getUserDetail,
    blockUser: setBlocked(true),
    unblockUser: setBlocked(false),
  };
};

module.exports = createUserManagementController;
