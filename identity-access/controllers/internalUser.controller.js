const createInternalUserController = ({ userRepository, userService }) => {
  const getUserSummary = async (req, res, next) => {
    try {
      const user = await userRepository.findUserById(req.params.id);
      if (!user) {
        return res.status(404).json({
          error: "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      return res.status(200).json({
        success: true,
        data: userService.getCurrentUser(user),
        message: "User summary",
      });
    } catch (error) {
      return next(error);
    }
  };

  const searchUsers = async (req, res, next) => {
    try {
      const ids = String(req.query.ids || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const name = String(req.query.name || "").trim();
      const role = String(req.query.role || "").trim();

      if (ids.length === 0 && !name) {
        return res.status(400).json({
          error: "ids or name is required",
          code: "USER_SEARCH_QUERY_REQUIRED",
        });
      }

      const users =
        ids.length > 0
          ? await userRepository.findUsersByIds(ids)
          : await userRepository.findUsersByRoleAndNameRegex(
              name,
              role ? [role] : [],
            );

      return res.status(200).json({
        success: true,
        data: { users: users.map((user) => userService.getCurrentUser(user)) },
        message: "Users retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { getUserSummary, searchUsers };
};

module.exports = createInternalUserController;
