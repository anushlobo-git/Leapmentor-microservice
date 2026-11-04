const invalid = (message) => Object.assign(new Error(message), { statusCode: 400, code: "INVALID_ESCROW_RELEASE" });

module.exports = (req, _res, next) => {
  if (!req.body?.connectRequestId || !req.body?.menteeId) return next(invalid("connectRequestId and menteeId are required"));
  return next();
};
