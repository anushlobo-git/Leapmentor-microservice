const express = require("express");

const createInternalEscrowRouter = ({ controller, validate }) => {
  const router = express.Router();
  router.post("/release", validate, controller.release);
  return router;
};

module.exports = createInternalEscrowRouter;
