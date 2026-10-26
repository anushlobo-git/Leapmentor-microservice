const express = require("express");

const createMentorSearchRouter = ({
  mentorSearchController,
  authenticate,
  requireRole,
  validations,
}) => {
  const router = express.Router();

  router.get(
    "/search",
    authenticate,
    requireRole("mentee"),
    validations.searchMentorsValidation,
    mentorSearchController.searchMentors,
  );

  return router;
};

module.exports = createMentorSearchRouter;
