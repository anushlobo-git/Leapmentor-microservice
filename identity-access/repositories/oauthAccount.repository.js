const createOAuthAccountRepository = (OAuthAccount) => {
  const findOAuthAccount = (provider, providerId) =>
    OAuthAccount.findOne({ provider, providerId });

  const findOAuthAccountWithUser = (provider, providerId) =>
    OAuthAccount.findOne({ provider, providerId }).populate("user");

  const createOAuthAccount = (data) => OAuthAccount.create(data);

  return {
    findOAuthAccount,
    findOAuthAccountWithUser,
    createOAuthAccount,
  };
};

module.exports = createOAuthAccountRepository;
