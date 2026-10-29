const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const getEnv = (key, fallback) => {
  const value = process.env[key];
  return value === undefined ? fallback : value;
};

module.exports = {
  serviceName: "mentoring-workspace",
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: Number(getEnv("PORT", "5003")),
  mongoUri: getEnv("MONGO_URI", ""),
  mongoServerSelectionTimeoutMs: Number(
    getEnv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"),
  ),
  redisUrl: getEnv("REDIS_URL", "redis://localhost:6379"),
  redisEnabled: getEnv("REDIS_ENABLED", "false") === "true",
  notificationStreamName: getEnv(
    "NOTIFICATION_STREAM_NAME",
    "leapmentor.workspace.events",
  ),
  notificationEventsStreamName: getEnv("NOTIFICATION_EVENTS_STREAM_NAME", "leapmentor.notification.events"),
  notificationEventsConsumerGroup: getEnv("NOTIFICATION_EVENTS_CONSUMER_GROUP", "mentoring-workspace-realtime"),
  notificationEventsConsumerName: getEnv("NOTIFICATION_EVENTS_CONSUMER_NAME", `workspace-${process.pid}`),
  clientUrl: getEnv("CLIENT_URL", "http://localhost:5173"),
  internalServiceToken: getEnv("WORKSPACE_SERVICE_TOKEN", ""),
  adminServiceToken: getEnv("ADMIN_SERVICE_TOKEN", ""),
  jwtAccessSecret: getEnv("JWT_ACCESS_SECRET", "development-access-secret"),
  notificationsServiceUrl: getEnv(
    "NOTIFICATIONS_SERVICE_URL",
    "http://localhost:5005",
  ),
  notificationsServiceToken: getEnv("NOTIFICATIONS_SERVICE_TOKEN", ""),
  internalRequestTimeoutMs: Number(
    getEnv("INTERNAL_REQUEST_TIMEOUT_MS", "3000"),
  ),
  identityServiceUrl: getEnv("IDENTITY_SERVICE_URL", "http://localhost:5001"),
  identityServiceToken: getEnv("IDENTITY_SERVICE_TOKEN", ""),
  profileServiceUrl: getEnv("PROFILE_SERVICE_URL", "http://localhost:5002"),
  profileServiceToken: getEnv("PROFILE_SERVICE_TOKEN", ""),
  paymentsServiceUrl: getEnv("PAYMENTS_SERVICE_URL", "http://localhost:5004"),
  paymentsServiceToken: getEnv("PAYMENTS_SERVICE_TOKEN", ""),
  cloudinary: {
    cloudName: getEnv("CLOUDINARY_CLOUD_NAME", ""),
    apiKey: getEnv("CLOUDINARY_API_KEY", ""),
    apiSecret: getEnv("CLOUDINARY_API_SECRET", ""),
  },
};
