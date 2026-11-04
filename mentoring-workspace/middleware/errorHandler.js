const errorHandler = (error, _req, res, _next) => {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    data: null,
    message: error.message || "Internal server error",
    error: error.message || "Internal server error",
    code: error.code || "INTERNAL_ERROR",
  });
};

module.exports = errorHandler;
