const express = require("express");

const createInternalAdminStatsRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/stats", controller.getStats);
  router.get("/user-growth", controller.getUserGrowth);
  return router;
};

module.exports = createInternalAdminStatsRouter;
