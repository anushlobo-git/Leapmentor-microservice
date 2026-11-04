const express = require("express");

const createInternalLeapRequestRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/", controller.getAllRequests);
  router.get("/pending-count", controller.getPendingCount);
  router.patch("/:id/approve", controller.approveRequest);
  router.patch("/:id/reject", controller.rejectRequest);
  return router;
};

module.exports = createInternalLeapRequestRouter;
