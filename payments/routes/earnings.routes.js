const express = require("express");

const createEarningsRouter = ({ controller, authenticate }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/", controller.getEarningsSummary);
  router.get("/chart", controller.getEarningsChart);
  router.get("/payouts", controller.getPayoutHistory);
  router.post("/withdraw", controller.withdrawEarnings);
  return router;
};

module.exports = createEarningsRouter;
