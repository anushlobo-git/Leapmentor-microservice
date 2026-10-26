const getEnv = (key, fallback) => {
  const value = process.env[key];
  return value === undefined ? fallback : value;
};

module.exports = {
  serviceName: "identity-access",
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: Number(getEnv("PORT", "5001")),
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
  jwtAccessExpiresIn: getEnv("JWT_ACCESS_EXPIRES_IN", "15m"),
  jwtRefreshExpiresIn: getEnv("JWT_REFRESH_EXPIRES_IN", "7d"),
  appBaseUrl: getEnv("APP_BASE_URL", "http://localhost:5173"),
  clientUrl: getEnv("CLIENT_URL", getEnv("APP_BASE_URL", "http://localhost:5173")),
  oauthStateSecret: getEnv(
    "OAUTH_STATE_SECRET",
    "development-oauth-state-secret",
  ),
  google: {
    clientId: getEnv("GOOGLE_CLIENT_ID", ""),
  },
  linkedin: {
    clientId: getEnv("LINKEDIN_CLIENT_ID", ""),
    clientSecret: getEnv("LINKEDIN_CLIENT_SECRET", ""),
    callbackUrl: getEnv(
      "LINKEDIN_CALLBACK_URL",
      "http://localhost:5001/api/v1/auth/linkedin/callback",
    ),
  },
  smtp: {
    host: getEnv("SMTP_HOST", "smtp.gmail.com"),
    port: Number(getEnv("SMTP_PORT", "587")),
    user: getEnv("SMTP_USER", ""),
    pass: getEnv("SMTP_PASS", ""),
    fromEmail: getEnv("FROM_EMAIL", ""),
  },
  paymentsServiceUrl: getEnv(
    "PAYMENTS_SERVICE_URL",
    "http://localhost:5004",
  ),
  paymentsServiceToken: getEnv("PAYMENTS_SERVICE_TOKEN", ""),
  internalHttpTimeoutMs: Number(
    getEnv("INTERNAL_HTTP_TIMEOUT_MS", "3000"),
  ),
  profileServiceToken: getEnv("PROFILE_SERVICE_TOKEN", ""),
  adminServiceToken: getEnv("ADMIN_SERVICE_TOKEN", ""),
};
