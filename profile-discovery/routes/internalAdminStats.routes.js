const express = require("express");

const createInternalAdminStatsRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/stats/mentor-industries", controller.getMentorIndustryStats);
  return router;
};

module.exports = createInternalAdminStatsRouter;
