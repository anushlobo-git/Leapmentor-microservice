const express = require("express");

const createAdminPaymentsRouter = ({ controller, authenticate }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/stats", controller.getStats);
  router.get("/chart", controller.getRevenueChart);
  router.get("/transactions", controller.getTransactions);
  return router;
};

module.exports = createAdminPaymentsRouter;