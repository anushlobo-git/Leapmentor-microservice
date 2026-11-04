const createVerificationTokenRepository = (VerificationToken) => {
  const deleteTokensByUserId = (userId) => VerificationToken.deleteMany({ user: userId });

  const createToken = (data) => VerificationToken.create(data);

  const findTokenByUserId = (userId) => VerificationToken.findOne({ user: userId });

  const saveToken = (token) => token.save();

  return {
    deleteTokensByUserId,
    createToken,
    findTokenByUserId,
    saveToken,
  };
};

module.exports = createVerificationTokenRepository;
