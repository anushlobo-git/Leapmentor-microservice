const express = require("express");

const createWalletRouter = ({ walletController, authenticate }) => {
  const router = express.Router();

  router.get("/wallet", authenticate, walletController.getMyWallet);

  return router;
};

module.exports = createWalletRouter;
