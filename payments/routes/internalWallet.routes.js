const express = require("express");

const createInternalWalletRouter = ({ walletController }) => {
  const router = express.Router();

  router.post("/provision", walletController.provisionWallets);

  return router;
};

module.exports = createInternalWalletRouter;
