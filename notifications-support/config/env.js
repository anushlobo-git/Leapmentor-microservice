const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const getEnv = (key, fallback) => {
  const value = process.env[key];
  return value === undefined ? fallback : value;
};

module.exports = {
  serviceName: "notifications-support",
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: Number(getEnv("PORT", "5005")),
  mongoUri: getEnv("MONGO_URI", ""),
  mongoServerSelectionTimeoutMs: Number(
    getEnv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"),
  ),
  redisUrl: getEnv("REDIS_URL", "redis://localhost:6379"),
  redisEnabled: getEnv("REDIS_ENABLED", "false") === "true",
  notificationStreamName: getEnv("NOTIFICATION_STREAM_NAME", "leapmentor.workspace.events"),
  notificationConsumerGroup: getEnv("NOTIFICATION_CONSUMER_GROUP", "notifications-support"),
  notificationConsumerName: getEnv("NOTIFICATION_CONSUMER_NAME", `notifications-${process.pid}`),
  notificationEventsStreamName: getEnv("NOTIFICATION_EVENTS_STREAM_NAME", "leapmentor.notification.events"),
  appBaseUrl: getEnv("APP_BASE_URL", "http://localhost:8080"),
  jwtAccessSecret: getEnv("JWT_ACCESS_SECRET", "development-access-secret"),
  workspaceServiceToken: getEnv("WORKSPACE_SERVICE_TOKEN", ""),
  groqApiKey: getEnv("GROQ_API_KEY", ""),
  groqApiUrl: getEnv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions"),
  groqModel: getEnv("GROQ_MODEL", "llama-3.1-8b-instant"),
};
