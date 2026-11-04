const express = require("express");

const createAvailabilityRouter = ({
  availabilityController,
  authenticate,
  requireRole,
  validations,
}) => {
  const router = express.Router();

  router.get(
    "/me",
    authenticate,
    requireRole("mentor"),
    availabilityController.getMyAvailability,
  );
  router.post(
    "/",
    authenticate,
    requireRole("mentor"),
    validations.createAvailabilityValidation,
    availabilityController.createAvailability,
  );
  router.patch(
    "/me",
    authenticate,
    requireRole("mentor"),
    validations.updateAvailabilityValidation,
    availabilityController.updateAvailability,
  );
  router.delete(
    "/me",
    authenticate,
    requireRole("mentor"),
    availabilityController.deleteAvailability,
  );
  router.get(
    "/:mentorId/slots",
    authenticate,
    validations.durationValidation,
    availabilityController.getAvailableSlots,
  );
  router.get("/:mentorId", availabilityController.getMentorAvailability);

  return router;
};

module.exports = createAvailabilityRouter;
