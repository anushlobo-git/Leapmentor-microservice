const express = require("express");
const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

const validateId = (req, _res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id))
    return next(
      new AppError("Invalid request id", 400, "INVALID_LEAP_REQUEST_ID"),
    );
  return next();
};

const createLeapRequestsRouter = ({ controller, authenticate }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/", controller.getRequests);
  router.get("/pending-count", controller.getPendingCount);
  router.patch("/:id/approve", validateId, controller.approve);
  router.patch("/:id/reject", validateId, controller.reject);
  return router;
};

module.exports = createLeapRequestsRouter;
