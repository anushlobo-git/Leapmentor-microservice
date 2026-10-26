const createWalletController = ({ walletService }) => {
  const provisionWallets = async (req, res, next) => {
    try {
      const result = await walletService.provisionWallets({
        userId: req.body?.userId,
        roles: req.body?.roles,
        idempotencyKey: req.get("Idempotency-Key"),
      });

      res.status(result.created ? 201 : 200).json(result.response);
    } catch (error) {
      next(error);
    }
  };

  const getMyWallet = async (req, res, next) => {
    try {
      const wallet = await walletService.getMyWallet(req.user._id);
      return res.status(200).json({
        success: true,
        data: wallet,
        message: "Wallet retrieved",
      });
    } catch (error) {
      return next(error);
    }
  };

  return {
    provisionWallets,
    getMyWallet,
  };
};

module.exports = createWalletController;
