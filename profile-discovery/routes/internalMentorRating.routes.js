const express = require("express");

const createInternalMentorRatingRouter = ({ controller, validate }) => {
  const router = express.Router();
  router.put("/:userId/rating", validate, controller.updateRating);
  return router;
};

module.exports = createInternalMentorRatingRouter;
