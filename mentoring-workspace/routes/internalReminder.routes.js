const express = require("express");

const createInternalReminderRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/upcoming-sessions", controller.listUpcomingSessions);
  return router;
};

module.exports = createInternalReminderRouter;
