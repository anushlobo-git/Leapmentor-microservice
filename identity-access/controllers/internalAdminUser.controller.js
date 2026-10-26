const mongoose = require("mongoose");

const createInternalAdminUserController = ({ userRepository, userService }) => {
  const validateId = (id) => mongoose.Types.ObjectId.isValid(id);

  const listUsers = async (req, res, next) => {
    try {
      const result = await userRepository.findAdminUsers({
        search: req.query.search,
        role: req.query.role,
        page: req.query.page,
        limit: req.query.limit,
        deleted: req.query.deleted,
      });

      return res.status(200).json({
        success: true,
        data: {
          ...result,
          users: result.users.map(userService.getCurrentUser),
        },
        message: "Users retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const getUser = async (req, res, next) => {
    try {
      if (!validateId(req.params.id)) {
        return res.status(400).json({
          error: "Invalid user id",
          code: "INVALID_USER_ID",
        });
      }

      const user = await userRepository.findAdminUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      }

      return res.status(200).json({
        success: true,
        data: { user: userService.getCurrentUser(user) },
        message: "User details retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  const setDeleted = (isDeleted) => async (req, res, next) => {
    try {
      if (!validateId(req.params.id)) {
        return res.status(400).json({ error: "Invalid user id", code: "INVALID_USER_ID" });
      }

      const user = await userRepository.updateAdminUserDeletedState(
        req.params.id,
        isDeleted,
      );
      if (!user) {
        return res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      }

      return res.status(200).json({
        success: true,
        data: { user: userService.getCurrentUser(user) },
        message: isDeleted ? "User blocked" : "User restored",
      });
    } catch (error) {
      return next(error);
    }
  };

  return { listUsers, getUser, blockUser: setDeleted(true), unblockUser: setDeleted(false) };
};

module.exports = createInternalAdminUserController;
