const express = require("express");

const createMessageRouter = ({ controller, authenticate, validations }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/:connectRequestId", validations.validateConnectRequestId, controller.getMessages);
  router.get("/:connectRequestId/unread", validations.validateConnectRequestId, controller.getUnreadCount);
  return router;
};

module.exports = createMessageRouter;
