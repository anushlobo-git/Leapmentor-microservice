const express = require("express");

const createNotificationRouter = ({ controller, authenticate, validations }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/", controller.getNotifications);
  router.patch("/mark-all-read", controller.markAllRead);
  router.patch("/:id/read", validations.validateNotificationId, controller.markOneRead);
  router.delete("/clear-all", controller.clearAll);
  router.delete("/:id", validations.validateNotificationId, controller.deleteNotification);
  return router;
};

module.exports = createNotificationRouter;
