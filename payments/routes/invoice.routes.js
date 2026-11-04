const express = require("express");
const mongoose = require("mongoose");

const validateConnectRequestId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.connectRequestId)) {
    return res
      .status(400)
      .json({
        error: "Invalid connect request id",
        code: "INVALID_CONNECT_REQUEST_ID",
      });
  }
  return next();
};

const createInvoiceRouter = ({ controller, authenticate }) => {
  const router = express.Router();
  router.get(
    "/:connectRequestId",
    authenticate,
    validateConnectRequestId,
    controller.downloadInvoice,
  );
  return router;
};

module.exports = createInvoiceRouter;
