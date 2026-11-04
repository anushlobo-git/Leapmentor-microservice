const createAuthenticate = ({ tokenService, identityClient }) => {
  return async (req, res, next) => {
    try {
      const authorization = req.get("Authorization") || "";
      const [scheme, token] = authorization.split(" ");
      if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "No token provided" });
      }

      const decoded = tokenService.verifyAccessToken(token);
      const user = await identityClient.getUserSummary(
        decoded.id,
        req.correlationId,
      );
      if (!user) return res.status(401).json({ message: "User not found" });
      req.user = user;
      return next();
    } catch (error) {
      return res.status(error.statusCode || 401).json({
        message: error.message || "Invalid or expired token",
        code: error.code || "INVALID_ACCESS_TOKEN",
      });
    }
  };
};

const createRoleGuard = (...roles) => (req, res, next) => {
  if (!roles.some((role) => req.user?.roles?.includes(role))) {
    return res.status(403).json({
      message: "Access denied: insufficient role",
      code: "ROLE_REQUIRED",
    });
  }
  return next();
};

module.exports = { createAuthenticate, createRoleGuard };
