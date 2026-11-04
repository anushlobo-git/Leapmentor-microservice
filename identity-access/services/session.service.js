const AppError = require("../utils/AppError");
const { toUserDTO } = require("../utils/user.mapper");

const createSessionService = ({ userRepository, tokenService }) => {
  const refreshAccessToken = async (rawToken) => {
    if (!rawToken) {
      throw new AppError(
        "Refresh token parameter missing from secure payload contexts.",
        401,
        "REFRESH_TOKEN_MISSING",
      );
    }

    const decoded = tokenService.verifyRefreshToken(rawToken);
    const user = await userRepository.findUserById(decoded.id);
    if (!user) {
      throw new AppError("User account not found.", 401, "USER_NOT_FOUND");
    }
    if (user.isDeleted) {
      throw new AppError("User account not found.", 401, "USER_NOT_FOUND");
    }

    return {
      accessToken: tokenService.signAccessToken(decoded.id),
      user: toUserDTO(user),
    };
  };

  return {
    refreshAccessToken,
  };
};

module.exports = createSessionService;
