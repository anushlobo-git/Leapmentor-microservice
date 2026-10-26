const getEnv = (key, fallback) => {
  const value = process.env[key];
  return value === undefined ? fallback : value;
};

module.exports = {
  serviceName: "admin-moderation",
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: Number(getEnv("PORT", "5006")),
  mongoUri: getEnv("MONGO_URI", ""),
  mongoServerSelectionTimeoutMs: Number(
    getEnv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"),
  ),
  redisUrl: getEnv("REDIS_URL", "redis://localhost:6379"),
  jwtAccessSecret: getEnv(
    "JWT_ACCESS_SECRET",
    "development-access-secret",
  ),
  jwtRefreshSecret: getEnv(
    "JWT_REFRESH_SECRET",
    "development-refresh-secret",
  ),
  adminAccessExpiresIn: getEnv("ADMIN_ACCESS_EXPIRES_IN", "15m"),
  adminRefreshExpiresIn: getEnv("ADMIN_REFRESH_EXPIRES_IN", "7d"),
  identityServiceUrl: getEnv("IDENTITY_SERVICE_URL", "http://localhost:5001"),
  profileServiceUrl: getEnv("PROFILE_SERVICE_URL", "http://localhost:5002"),
  workspaceServiceUrl: getEnv("WORKSPACE_SERVICE_URL", "http://localhost:5003"),
  paymentsServiceUrl: getEnv("PAYMENTS_SERVICE_URL", "http://localhost:5004"),
  adminServiceToken: getEnv("ADMIN_SERVICE_TOKEN", ""),
  internalServiceToken: getEnv("INTERNAL_SERVICE_TOKEN", ""),
  internalHttpTimeoutMs: Number(getEnv("INTERNAL_HTTP_TIMEOUT_MS", "3000")),
};
