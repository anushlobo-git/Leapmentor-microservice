const createAuthenticate = ({ tokenService, userRepository }) => {
  return async (req, res, next) => {
    try {
      const authorization = req.get("Authorization") || "";
      const [scheme, token] = authorization.split(" ");
      if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "No token provided" });
      }

      const decoded = tokenService.verifyAccessToken(token);
      const user = await userRepository.findUserByIdForAuthentication(decoded.id);
      if (!user) return res.status(401).json({ message: "User not found" });
      if (user.isDeleted) {
        return res.status(403).json({
          message: "Your account has been blocked by an administrator.",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(error.statusCode || 401).json({
        message: error.message || "Invalid or expired token",
        code: error.code || "INVALID_ACCESS_TOKEN",
      });
    }
  };
};

module.exports = createAuthenticate;
