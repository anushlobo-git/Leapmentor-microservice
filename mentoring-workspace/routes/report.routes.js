const express = require("express");

const createReportRouter = ({ controller, authenticate, upload, validations }) => {
  const router = express.Router();
  router.use(authenticate);
  router.post("/", upload, validations.submitReportValidation, controller.submitReport);
  router.get("/my/:connectRequestId", validations.getMyReportValidation, controller.getMyReport);
  return router;
};

module.exports = createReportRouter;
