const express = require("express");

const createInternalAdminReportsRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/stats", controller.getStats);
  router.get("/", controller.getReports);
  router.get("/:reportId", controller.getReport);
  router.patch("/:reportId", controller.updateReport);
  router.delete("/:reportId/session", controller.deleteSession);
  return router;
};

module.exports = createInternalAdminReportsRouter;
