const express = require("express");

const createMenteeProfileRouter = ({
  menteeProfileController,
  authenticate,
  requireRole,
  validations,
}) => {
  const router = express.Router();

  router.get(
    "/me",
    authenticate,
    requireRole("mentee"),
    menteeProfileController.getMyProfile,
  );
  router.put(
    "/me",
    authenticate,
    requireRole("mentee"),
    validations.updateProfileValidation,
    menteeProfileController.updateProfile,
  );
  router.post(
    "/",
    authenticate,
    requireRole("mentee"),
    validations.createProfileValidation,
    menteeProfileController.createProfile,
  );
  router.get(
    "/:id",
    validations.menteeIdParamValidation,
    menteeProfileController.getPublicProfile,
  );

  return router;
};

module.exports = createMenteeProfileRouter;
