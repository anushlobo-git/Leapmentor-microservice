const express = require("express");

const createInternalRefundRouter = ({ controller }) => {
  const router = express.Router();
  router.post("/", controller.refund);
  return router;
};

module.exports = createInternalRefundRouter;
