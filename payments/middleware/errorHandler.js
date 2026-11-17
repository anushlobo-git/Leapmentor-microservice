const logger = require("../utils/logger");

const errorHandler = (error, req, res, _next) => {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;
  const log = statusCode >= 500 ? logger.error : logger.warn;
  log("HTTP request failed", {
    statusCode,
    code: error.code || "INTERNAL_ERROR",
    error: error.message || "Internal server error",
    traceId: req.correlationId,
  });

  res.status(statusCode).json({
    error: error.message || "Internal server error",
    code: error.code || "INTERNAL_ERROR",
  });
};

module.exports = errorHandler;
