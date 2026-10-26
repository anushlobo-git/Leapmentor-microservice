const jwt = require("jsonwebtoken");

const createTokenService = ({ accessSecret }) => ({
  verifyAccessToken: (token) => {
    try {
      const payload = jwt.verify(token, accessSecret);
      if (payload.type !== "access") throw new Error("Invalid token type");
      return payload;
    } catch {
      const error = new Error("Invalid or expired access token");
      error.statusCode = 401;
      error.code = "INVALID_ACCESS_TOKEN";
      throw error;
    }
  },
});

module.exports = createTokenService;
