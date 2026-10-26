const getEnv = (key, fallback) => {
  const value = process.env[key];
  return value === undefined ? fallback : value;
};

module.exports = {
  serviceName: "profile-discovery",
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: Number(getEnv("PORT", "5002")),
  mongoUri: getEnv("MONGO_URI", ""),
  mongoServerSelectionTimeoutMs: Number(
    getEnv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"),
  ),
  redisUrl: getEnv("REDIS_URL", "redis://localhost:6379"),
  jwtAccessSecret: getEnv(
    "JWT_ACCESS_SECRET",
    "development-access-secret",
  ),
  identityServiceUrl: getEnv(
    "IDENTITY_SERVICE_URL",
    "http://localhost:5001",
  ),
  identityServiceToken: getEnv("IDENTITY_SERVICE_TOKEN", ""),
  profileServiceToken: getEnv("PROFILE_SERVICE_TOKEN", ""),
  adminServiceToken: getEnv("ADMIN_SERVICE_TOKEN", ""),
  internalHttpTimeoutMs: Number(
    getEnv("INTERNAL_HTTP_TIMEOUT_MS", "3000"),
  ),
  workspaceServiceUrl: getEnv(
    "WORKSPACE_SERVICE_URL",
    "http://localhost:5003",
  ),
  workspaceServiceToken: getEnv("WORKSPACE_SERVICE_TOKEN", ""),
  cloudinary: {
    cloudName: getEnv("CLOUDINARY_CLOUD_NAME", ""),
    apiKey: getEnv("CLOUDINARY_API_KEY", ""),
    apiSecret: getEnv("CLOUDINARY_API_SECRET", ""),
  },
  googleCalendar: {
    clientId: getEnv("GOOGLE_CLIENT_ID", ""),
    clientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
    redirectUri: getEnv("GOOGLE_REDIRECT_URI", "http://localhost:5002/api/v1/google-calendar/callback"),
    stateSecret: getEnv(
      "GOOGLE_CALENDAR_STATE_SECRET",
      "development-google-calendar-state-secret",
    ),
  },
};
