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

const emailPayloadValidation = (req, _res, next) => {
  try {
    validateEmail(req.body?.email);
    next();
  } catch (error) {
    next(error);
  }
};

const verifyOtpValidation = (req, _res, next) => {
  try {
    validateEmail(req.body?.email);
    if (!/^\d{6}$/.test(String(req.body?.otp || "").trim())) {
      throw invalid("Verification OTP must contain exactly 6 digits.");
    }
    next();
  } catch (error) {
    next(error);
  }
};

const verifyLinkValidation = (req, _res, next) => {
  try {
    validateEmail(req.query?.email);
    if (!String(req.params?.token || "").trim()) {
      throw invalid("Verification token is required.");
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  emailPayloadValidation,
  verifyOtpValidation,
  verifyLinkValidation,
};
