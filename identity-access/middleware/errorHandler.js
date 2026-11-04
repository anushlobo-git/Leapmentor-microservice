const errorHandler = (error, _req, res, _next) => {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : error.code === 11000
      ? 409
      : 500;

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
