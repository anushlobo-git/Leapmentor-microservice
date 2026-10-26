const express = require("express");

const createEscrowRouter = ({ escrowController, authenticate, validations }) => {
  const router = express.Router();
  router.use(authenticate);
  router.post("/pay", validations.payValidation, escrowController.pay);
  router.post("/pay-additional", validations.payAdditionalValidation, escrowController.payAdditional);
  router.post("/release/:requestId", validations.requestIdValidation, escrowController.release);
  router.post("/refund/:requestId", validations.requestIdValidation, escrowController.refund);
  router.get("/status/:requestId", validations.requestIdValidation, escrowController.getStatus);
  return router;
};

module.exports = createEscrowRouter;
