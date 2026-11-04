const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_UPLOAD_FIELDS";
  return error;
};

const verificationDocumentsValidation = (req, _res, next) => {
  const phoneNumber = String(req.body?.phoneNumber || "").trim();
  if (phoneNumber.length < 5 || phoneNumber.length > 20) {
    return next(invalid("Phone number must be between 5 and 20 characters."));
  }
  return next();
};

module.exports = { verificationDocumentsValidation };
