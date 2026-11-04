class AppError extends Error {
  constructor(message, statusCode = 500, code = "APP_ERROR", details = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    Object.assign(this, details);
  }
}

module.exports = AppError;
