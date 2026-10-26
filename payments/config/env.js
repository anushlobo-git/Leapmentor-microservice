const getEnv = (key, fallback) => {
  const value = process.env[key];
  return value === undefined ? fallback : value;
};

module.exports = {
  serviceName: "payments",
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: Number(getEnv("PORT", "5004")),
  mongoUri: getEnv("MONGO_URI", ""),
  mongoServerSelectionTimeoutMs: Number(
    getEnv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"),
  ),
  redisUrl: getEnv("REDIS_URL", "redis://localhost:6379"),
  internalServiceToken: getEnv("INTERNAL_SERVICE_TOKEN", ""),
  jwtAccessSecret: getEnv(
    "JWT_ACCESS_SECRET",
    "development-access-secret",
  ),
  commissionRate: Number(getEnv("COMMISSION_RATE", "20")),
  workspaceServiceUrl: getEnv(
    "WORKSPACE_SERVICE_URL",
    "http://localhost:5003",
  ),
  workspaceServiceToken: getEnv("WORKSPACE_SERVICE_TOKEN", ""),
  internalHttpTimeoutMs: Number(getEnv("INTERNAL_HTTP_TIMEOUT_MS", "3000")),
};
