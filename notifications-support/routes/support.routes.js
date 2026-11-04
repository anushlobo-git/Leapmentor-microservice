const express = require("express");

const createSupportRouter = ({ controller, adminAuthenticate, optionalAuthenticate, validations }) => {
  const router = express.Router();
  router.post("/messages", optionalAuthenticate, validations.validateCreateMessage, controller.createMessage);
  router.use("/messages", adminAuthenticate);
  router.get("/messages", controller.getMessages);
  router.patch("/messages/:id/resolve", validations.validateTicketId, controller.resolveMessage);
  return router;
};

module.exports = createSupportRouter;
