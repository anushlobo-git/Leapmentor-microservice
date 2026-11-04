const { ALL_ROLES } = require("../constants/roles");

const invalid = (message, code = "INVALID_SOCIAL_REQUEST") => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

const validateOptionalRoles = (roles) => {
  if (roles === undefined) return;
  if (!Array.isArray(roles) || roles.length === 0) {
    throw invalid("Roles must be a non-empty array.", "INVALID_ROLES");
  }
  const invalidRole = roles.find((role) => !ALL_ROLES.includes(role));
  if (invalidRole) {
    throw invalid(`Invalid role "${invalidRole}".`, "INVALID_ROLE");
  }
};

const googleValidation = (req, _res, next) => {
  try {
    if (!req.body?.credential) {
      throw invalid("Google credential token is required.", "GOOGLE_CREDENTIAL_REQUIRED");
    }
    validateOptionalRoles(req.body.roles);
    if (
      req.body.termsAccepted !== undefined &&
      typeof req.body.termsAccepted !== "boolean"
    ) {
      throw invalid("termsAccepted must be a boolean.");
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const linkedinValidation = (req, _res, next) => {
  try {
    if (!req.body?.code) {
      throw invalid(
        "LinkedIn authorization code is required.",
        "LINKEDIN_CODE_REQUIRED",
      );
    }
    validateOptionalRoles(req.body.roles);
    if (
      req.body.termsAccepted !== undefined &&
      typeof req.body.termsAccepted !== "boolean"
    ) {
      throw invalid("termsAccepted must be a boolean.");
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const socialValidation = (req, _res, next) => {
  try {
    if (!req.body?.provider || !req.body?.providerId) {
      throw invalid(
        "provider and providerId are required.",
        "INVALID_SOCIAL_IDENTITY",
      );
    }
    validateOptionalRoles(req.body.roles);
    if (
      req.body.termsAccepted !== undefined &&
      typeof req.body.termsAccepted !== "boolean"
    ) {
      throw invalid("termsAccepted must be a boolean.");
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { googleValidation, linkedinValidation, socialValidation };
