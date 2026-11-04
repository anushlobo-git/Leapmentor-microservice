const express = require("express");
const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

const validateReportId = (req, _res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.reportId)) return next(new AppError("Invalid report id", 400, "INVALID_REPORT_ID"));
  return next();
};

const createReportsRouter = ({ controller, authenticate }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/stats", controller.getStats);
  router.get("/", controller.getReports);
  router.patch("/:reportId", validateReportId, controller.updateReport);
  router.post("/:reportId/refund", validateReportId, controller.processRefund);
  router.delete("/:reportId/session", validateReportId, controller.deleteSession);
  return router;
};

module.exports = createReportsRouter;
