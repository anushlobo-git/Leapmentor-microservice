const express = require("express");

const createAiRouter = ({ controller, authenticate, validation }) => {
  const router = express.Router();
  router.use(authenticate);
  router.post("/chat", validation.validateChat, controller.handleChat);
  return router;
};

module.exports = createAiRouter;
