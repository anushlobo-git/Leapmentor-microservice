const express = require("express");

const createLeapRequestRouter = ({ controller, authenticate }) => {
  const router = express.Router();
  router.get("/my-request", authenticate, controller.getMyRequest);
  router.post("/", authenticate, controller.createRequest);
  return router;
};

module.exports = createLeapRequestRouter;
