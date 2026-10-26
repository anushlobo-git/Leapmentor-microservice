const express = require("express");

const createDashboardRouter = ({ controller, authenticate }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/stats", controller.getStats);
  router.get("/user-growth", controller.getUserGrowth);
  router.get("/stats/mentor-industries", controller.getMentorIndustryStats);
  router.get("/engagements/stats", controller.getEngagementStats);
  return router;
};

module.exports = createDashboardRouter;
