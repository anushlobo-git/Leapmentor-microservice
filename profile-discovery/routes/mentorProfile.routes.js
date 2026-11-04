const express = require("express");

const createMentorProfileRouter = ({
  mentorProfileController,
  authenticate,
  requireRole,
  validations,
}) => {
  const router = express.Router();

  router.get(
    "/me",
    authenticate,
    requireRole("mentor"),
    mentorProfileController.getMyProfile,
  );
  router.put(
    "/me",
    authenticate,
    requireRole("mentor"),
    validations.updateProfileValidation,
    mentorProfileController.updateProfile,
  );
  router.post(
    "/",
    authenticate,
    requireRole("mentor"),
    validations.createProfileValidation,
    mentorProfileController.createProfile,
  );
  router.get(
    "/:id",
    validations.mentorIdParamValidation,
    mentorProfileController.getPublicProfile,
  );

  return router;
};

module.exports = createMentorProfileRouter;
