const express = require("express");

const createInternalAdminStatsRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/engagements/stats", controller.getEngagementStats);
  return router;
};

module.exports = createInternalAdminStatsRouter;
