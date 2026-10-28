const express = require("express");

const createInternalAdminPaymentsRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/summary", controller.getSummary);
  router.get("/transactions", controller.getTransactions);
  return router;
};

module.exports = createInternalAdminPaymentsRouter;