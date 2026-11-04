const express = require("express");
const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

const validateId = (req, _res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.mentorProfileId)) return next(new AppError("Invalid mentor profile id", 400, "INVALID_MENTOR_PROFILE_ID"));
  return next();
};

const createVerificationRouter = ({ controller, authenticate }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/", controller.list);
  router.get("/:mentorProfileId", validateId, controller.getById);
  router.patch("/:mentorProfileId/verify", validateId, controller.verify);
  router.patch("/:mentorProfileId/revoke", validateId, controller.revoke);
  return router;
};

module.exports = createVerificationRouter;
