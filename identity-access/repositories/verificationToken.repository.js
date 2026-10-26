const createVerificationTokenRepository = (VerificationToken) => {
  const deleteTokensByUserId = (userId) =>
    VerificationToken.deleteMany({ user: userId });

  const createToken = (data) => VerificationToken.create(data);

  const findTokenByUserId = (userId) =>
    VerificationToken.findOne({ user: userId });

  return {
    deleteTokensByUserId,
    createToken,
    findTokenByUserId,
  };
};

module.exports = createVerificationTokenRepository;
