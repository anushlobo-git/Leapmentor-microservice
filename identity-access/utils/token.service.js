const jwt = require("jsonwebtoken");

const AppError = require("./AppError");

const createTokenService = ({
  accessSecret,
  refreshSecret,
  accessExpiresIn,
  refreshExpiresIn,
}) => ({
  signAccessToken: (userId) =>
    jwt.sign({ id: userId.toString(), type: "access" }, accessSecret, {
      expiresIn: accessExpiresIn,
    }),
  signRefreshToken: (userId) =>
    jwt.sign({ id: userId.toString(), type: "refresh" }, refreshSecret, {
      expiresIn: refreshExpiresIn,
    }),
  verifyAccessToken: (token) => {
    try {
      const payload = jwt.verify(token, accessSecret);
      if (payload.type !== "access") throw new Error("Invalid token type");
      return payload;
    } catch {
      throw new AppError(
        "Invalid or expired access token",
        401,
        "INVALID_ACCESS_TOKEN",
      );
    }
  },
  verifyRefreshToken: (token) => {
    try {
      const payload = jwt.verify(token, refreshSecret);
      if (payload.type !== "refresh") {
        throw new Error("Invalid token type");
      }
      return payload;
    } catch {
      throw new AppError(
        "Invalid or expired session refresh token reference.",
        403,
        "INVALID_REFRESH_TOKEN",
      );
    }
  },
});

module.exports = createTokenService;
