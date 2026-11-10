const http = require("node:http");

const createApp = require("./app");
const container = require("./container");
const env = require("./config/env");
const logger = require("./utils/logger");

const app = createApp(container);
const httpServer = http.createServer(app);

let server;

const startServer = async () => {
  try {
    const connected = await container.database.connectDatabase();
    if (!connected) {
      logger.warn("MONGO_URI is not configured; Admin persistence will remain not ready");
    }

    server = httpServer.listen(env.port, () => {
      logger.info("Service listening", { port: env.port });
    });
  } catch (error) {
    logger.error("Admin database startup failed", { error });
    process.exitCode = 1;
  }
};

const shutdown = (signal) => {
  logger.info("Shutdown signal received", { signal });

  if (!server) {
    container.database.closeDatabase().finally(() => process.exit());
    return;
  }

  server.close(async (error) => {
    if (error) {
      logger.error("HTTP server shutdown failed", { error });
      process.exitCode = 1;
    }

    try {
      await container.database.closeDatabase();
    } catch (closeError) {
      logger.error("Database shutdown failed", { error: closeError });
      process.exitCode = 1;
    }

    process.exit();
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
