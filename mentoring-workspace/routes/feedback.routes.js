const express = require("express");

const createFeedbackRouter = ({ controller, authenticate, validations }) => {
  const router = express.Router();
  router.use(authenticate);
  router.post("/", validations.createFeedbackValidation, controller.createFeedback);
  router.get(
    "/:connectRequestId",
    validations.getFeedbackValidation,
    controller.getFeedback,
  );
  return router;
};

module.exports = createFeedbackRouter;
