const createInternalServiceAuth = ({ serviceToken }) => (req, res, next) => {
  if (!serviceToken) {
    return res.status(503).json({
      error: "Internal service authentication is not configured",
      code: "INTERNAL_AUTH_NOT_CONFIGURED",
    });
  }
  if (req.get("Authorization") !== `Bearer ${serviceToken}`) {
    return res.status(401).json({
      error: "Invalid internal service credentials",
      code: "INVALID_INTERNAL_AUTH",
    });
  }
  return next();
};

module.exports = createInternalServiceAuth;
