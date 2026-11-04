const express = require("express");

const createInternalAdminUserRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/:userId/completed-session-count", controller.getCompletedSessionCount);
  return router;
};

module.exports = createInternalAdminUserRouter;
