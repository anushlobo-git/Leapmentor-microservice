const express = require("express");

const createInternalAdminStatsRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/engagements/stats", controller.getEngagementStats);
  router.get("/engagements", controller.getEngagements);
  return router;
};

module.exports = createInternalAdminStatsRouter;
