const express = require("express");

const createUserManagementRouter = ({
  controller,
  authenticate,
  validateUsersQuery,
  validateUserId,
}) => {
  const router = express.Router();

  router.use(authenticate);
  router.get("/", validateUsersQuery, controller.getUsers);
  router.get("/:userId", validateUserId, controller.getUserDetail);
  router.patch("/:userId/block", validateUserId, controller.blockUser);
  router.patch("/:userId/unblock", validateUserId, controller.unblockUser);

  return router;
};

module.exports = createUserManagementRouter;
