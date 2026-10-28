const express = require("express");

const createInternalMentorLookupRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/:mentorId/similar", controller.getSimilarMentors);
  router.get("/:mentorId/availability", controller.getAvailability);
  return router;
};

module.exports = createInternalMentorLookupRouter;
