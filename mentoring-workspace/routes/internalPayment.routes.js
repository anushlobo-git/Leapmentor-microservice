const express = require("express");

const createInternalPaymentRouter = ({ internalPaymentController }) => {
  const router = express.Router();
  router.get("/:id/payment-context", internalPaymentController.getPaymentContext);
  router.patch("/:id/payment-state", internalPaymentController.updatePaymentState);
  return router;
};

module.exports = createInternalPaymentRouter;
