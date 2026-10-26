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
  notificationStreamName: getEnv("NOTIFICATION_STREAM_NAME", "leapmentor.notifications"),
  notificationConsumerGroup: getEnv("NOTIFICATION_CONSUMER_GROUP", "notifications-support"),
  notificationConsumerName: getEnv("NOTIFICATION_CONSUMER_NAME", `notifications-${process.pid}`),
  jwtAccessSecret: getEnv("JWT_ACCESS_SECRET", "development-access-secret"),
  workspaceServiceToken: getEnv("WORKSPACE_SERVICE_TOKEN", ""),
  groqApiKey: getEnv("GROQ_API_KEY", ""),
  groqApiUrl: getEnv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions"),
  groqModel: getEnv("GROQ_MODEL", "llama-3.1-8b-instant"),
};
