const express = require("express");

const createInternalEmailRouter = ({ controller }) => {
  const router = express.Router();
  router.post("/report-events", controller.sendReportEvent);
  router.post("/invoice-events", controller.sendReportEvent);
  return router;
};

module.exports = createInternalEmailRouter;
