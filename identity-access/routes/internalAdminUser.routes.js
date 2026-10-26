const express = require("express");

const createInternalAdminUserRouter = ({ controller }) => {
  const router = express.Router();

  router.get("/", controller.listUsers);
  router.get("/:id", controller.getUser);
  router.patch("/:id/block", controller.blockUser);
  router.patch("/:id/unblock", controller.unblockUser);

  return router;
};

module.exports = createInternalAdminUserRouter;
