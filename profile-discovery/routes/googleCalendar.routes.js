const express = require("express");

const createGoogleCalendarRouter = ({
  googleCalendarController,
  authenticate,
  requireRole,
  requireReady,
  validations,
}) => {
  const router = express.Router();

  router.get(
    "/callback",
    validations.handleCallbackValidation,
    googleCalendarController.handleCallback,
  );
  router.use(authenticate, requireRole("mentor"), requireReady);
  router.get("/auth-url", googleCalendarController.getAuthUrl);
  router.post("/disconnect", googleCalendarController.disconnect);
  router.get(
    "/busy",
    validations.getCalendarIntervalValidation,
    googleCalendarController.getBusySlots,
  );
  router.get(
    "/events",
    validations.getCalendarIntervalValidation,
    googleCalendarController.getEvents,
  );

  return router;
};

module.exports = createGoogleCalendarRouter;
