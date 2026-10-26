const express = require("express");

const createInternalAvailabilityRouter = ({ internalAvailabilityController }) => {
  const router = express.Router();
  router.get("/blockers/:mentorId", internalAvailabilityController.getBlockers);
  return router;
};

module.exports = createInternalAvailabilityRouter;
