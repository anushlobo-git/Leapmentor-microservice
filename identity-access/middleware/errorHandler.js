const logger = require("../utils/logger");

const errorHandler = (error, req, res, _next) => {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : error.code === 11000
      ? 409
      : 500;
  const log = statusCode >= 500 ? logger.error : logger.warn;
  log("HTTP request failed", {
    statusCode,
    code: error.code || "INTERNAL_ERROR",
    error: error.message || "Internal server error",
    traceId: req.correlationId,
  });

  res.status(statusCode).json({
    success: false,
    data: null,
    message: error.message || "Internal server error",
    error: error.message || "Internal server error",
    code: error.code || "INTERNAL_ERROR",
    ...(error.isEmailVerified !== undefined && {
      isEmailVerified: error.isEmailVerified,
    }),
    ...(error.email && { email: error.email }),
  });
};

module.exports = errorHandler;
