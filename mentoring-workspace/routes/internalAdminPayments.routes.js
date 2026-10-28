const express = require("express");

const createInternalAdminPaymentsRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/stats", controller.getStats);
  router.get("/chart", controller.getChart);
  return router;
};

module.exports = createInternalAdminPaymentsRouter;
