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
      logger.warn("MONGO_URI is not configured; Identity will remain not ready");
    }

    server = httpServer.listen(env.port, () => {
      logger.info("Service listening", { port: env.port });
    });
  } catch (error) {
    logger.error("Identity database startup failed", { error });
    process.exitCode = 1;
  }
};

const shutdown = (signal) => {
  logger.info("Shutdown signal received", { signal });

  if (!server) {
    process.exit(0);
  }

  server.close((error) => {
    container.database
      .closeDatabase()
      .catch((closeError) => {
        logger.error("Database shutdown failed", { error: closeError });
        process.exitCode = 1;
      })
      .finally(() => {
        if (error) {
          logger.error("HTTP server shutdown failed", { error });
          process.exitCode = 1;
        }
        process.exit();
      });
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
