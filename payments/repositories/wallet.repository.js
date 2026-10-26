const createWalletRepository = (Wallet) => {
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
    findWalletByUserAndRole,
    findByUserIdAndRole,
    save,
    createWallet,
  };
};

module.exports = createWalletRepository;
