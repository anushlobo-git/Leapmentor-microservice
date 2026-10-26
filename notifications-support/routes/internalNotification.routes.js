const express = require("express");

const createInternalNotificationRouter = ({ controller, validation }) => {
  const router = express.Router();
  router.post("/", validation.validateNotificationEvent, controller.create);
  return router;
};

module.exports = createInternalNotificationRouter;
