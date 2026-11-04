const toWalletDTO = (wallet) => ({
  walletId: wallet._id?.toString?.() || wallet._id,
  userId: wallet.user?.toString?.() || wallet.user,
  role: wallet.role,
  balance: wallet.balance ?? 0,
  escrow: wallet.escrow ?? 0,
  createdAt: wallet.createdAt,
  updatedAt: wallet.updatedAt,
});

module.exports = { toWalletDTO };
