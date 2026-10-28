const createWalletRepository = (Wallet) => {
  const sumEscrowBalances = async () => {
    const [result] = await Wallet.aggregate([
      { $group: { _id: null, total: { $sum: "$escrow" } } },
    ]);
    return result?.total || 0;
  };

  const findWalletByUserAndRole = (userId, role, session) => {
    const query = Wallet.findOne({ user: userId, role });
    return session ? query.session(session).lean() : query.lean();
  };

  const findByUserIdAndRole = (userId, role, session) => {
    const query = Wallet.findOne({ user: userId, role });
    return session ? query.session(session) : query;
  };

  const save = (wallet, session) =>
    wallet.save(session ? { session } : undefined);

  const createWallet = async (data, session) => {
    const created = await Wallet.create([data], session ? { session } : {});
    return created[0];
  };

  return {
    sumEscrowBalances,
    findWalletByUserAndRole,
    findByUserIdAndRole,
    save,
    createWallet,
  };
};

module.exports = createWalletRepository;
