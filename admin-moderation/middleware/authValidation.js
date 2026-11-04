const AppError = require("../utils/AppError");

const validateLogin = (req, _res, next) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !email.includes("@")) {
    return next(
      new AppError(
        "Administrative email address is required.",
        400,
        "INVALID_ADMIN_LOGIN",
      ),
    );
  }
  if (password.length < 8) {
    return next(
      new AppError(
        "Password must be at least 8 characters long.",
        400,
        "INVALID_ADMIN_LOGIN",
      ),
    );
  }

  req.body = { email, password };
  return next();
};

module.exports = { validateLogin };
