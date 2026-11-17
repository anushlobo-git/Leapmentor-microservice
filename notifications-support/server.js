const http = require("node:http");

const createApp = require("./app");
const container = require("./container");
const env = require("./config/env");
const logger = require("./utils/logger");

const app = createApp(container);
const httpServer = http.createServer(app);

let server;
let emailRetryTimer;

const startServer = async () => {
  const connected = await container.database.connectDatabase();
  if (!connected)
    logger.warn("MONGO_URI is not configured; Notifications will remain not ready");
  await container.notificationConsumer.start();
  if (connected) {
    container.sessionReminderService?.start();
    await container.reportEmailService
      ?.drainPendingEmailEvents()
      .catch((error) => {
        logger.error("Email recovery failed", { error });
      });
    emailRetryTimer = setInterval(() => {
      container.reportEmailService?.drainPendingEmailEvents().catch((error) => {
        logger.error("Email retry failed", { error });
      });
    }, 30000);
    emailRetryTimer.unref?.();
  }
  server = httpServer.listen(env.port, () => {
    logger.info("Service listening", { port: env.port });
  });
};

startServer().catch((error) => {
  logger.error("Notifications database startup failed", { error });
  process.exitCode = 1;
});

const shutdown = (signal) => {
  logger.info("Shutdown signal received", { signal });

  if (!server) return process.exit(0);
  if (emailRetryTimer) clearInterval(emailRetryTimer);
  container.sessionReminderService?.stop();
  server.close((error) => {
    container.notificationConsumer.stop().catch((stopError) => {
      logger.error("Notification consumer shutdown failed", { error: stopError });
    });
    container.database.closeDatabase().catch((closeError) => {
      logger.error("Database shutdown failed", { error: closeError });
      process.exitCode = 1;
    });
    container.notificationEventRedisClient?.quit().catch(() => null);
    if (error) {
      logger.error("HTTP server shutdown failed", { error });
      process.exitCode = 1;
    }

    process.exit();
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
