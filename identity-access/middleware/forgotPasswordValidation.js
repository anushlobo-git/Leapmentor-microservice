const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "VALIDATION_ERROR";
  return error;
};

const validateEmail = (email) => {
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    throw invalid("Please provide a valid email address.");
  }
};

const sendForgotPasswordOtpValidation = (req, _res, next) => {
  try {
    validateEmail(req.body?.email);
    next();
  } catch (error) {
    next(error);
  }
};

const verifyResetOtpValidation = (req, _res, next) => {
  try {
    validateEmail(req.body?.email);
    if (!String(req.body?.otp || "").trim()) {
      throw invalid("OTP is required.");
    }
    next();
  } catch (error) {
    next(error);
  }
};

const resetPasswordValidation = (req, _res, next) => {
  try {
    validateEmail(req.body?.email);
    if (!String(req.body?.otp || "").trim()) throw invalid("OTP is required.");
    if (typeof req.body?.newPassword !== "string" || req.body.newPassword.length < 6) {
      throw invalid("Password must be at least 6 characters");
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendForgotPasswordOtpValidation,
  verifyResetOtpValidation,
  resetPasswordValidation,
};
