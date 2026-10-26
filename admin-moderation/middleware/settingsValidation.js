const AppError = require("../utils/AppError");

const validateAddAdmin = (req, _res, next) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!name || !email.includes("@")) {
    return next(new AppError("A valid name and email are required.", 400, "INVALID_ADMIN_INPUT"));
  }
  req.body = { name, email };
  return next();
};

const validateChangePassword = (req, _res, next) => {
  const oldPassword = String(req.body?.oldPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  if (oldPassword.length < 8 || newPassword.length < 8) {
    return next(new AppError("Both passwords must be at least 8 characters long.", 400, "INVALID_PASSWORD_INPUT"));
  }
  if (oldPassword === newPassword) {
    return next(new AppError("The new password must be different.", 400, "PASSWORD_UNCHANGED"));
  }
  req.body = { oldPassword, newPassword };
  return next();
};

const validateCommission = (req, _res, next) => {
  const rate = Number(req.body?.commissionRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return next(new AppError("Commission rate must be between 0 and 100.", 400, "INVALID_COMMISSION_RATE"));
  }
  req.body = { commissionRate: rate };
  return next();
};

module.exports = { validateAddAdmin, validateChangePassword, validateCommission };
