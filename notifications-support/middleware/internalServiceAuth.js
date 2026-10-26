const createInternalServiceAuth = ({ serviceToken }) => (req, res, next) => {
  if (!serviceToken || req.get("Authorization") !== `Bearer ${serviceToken}`) {
    return res.status(401).json({ message: "Invalid internal service credentials", code: "INVALID_SERVICE_TOKEN" });
  }
  return next();
};

module.exports = createInternalServiceAuth;
