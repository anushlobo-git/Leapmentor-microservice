const http = require("node:http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const createApp = require("./app");
const container = require("./container");
const env = require("./config/env");
const configureRedisAdapter = require("./socket/configureRedisAdapter");
const logger = require("./utils/logger");

const app = createApp(container);
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.clientUrl, credentials: true },
});
io.use(container.socketAuth);
container.realtimePublisher.attach(io);
container.createMessageSocketHandler({
  io,
  messageService: container.messageService,
  messageRepository: container.messageRepository,
  connectRequestRepository: container.connectRequestRepository,
  notificationClient: container.notificationClient,
});

let server;
let notificationOutboxTimer;
let escrowReleaseRetryTimer;
let socketRedisAdapter;

const startServer = async () => {
  try {
    socketRedisAdapter = await configureRedisAdapter({
      io,
      enabled: env.redisEnabled,
      url: env.redisUrl,
      createClient,
      createAdapter,
    });
  } catch (error) {
    logger.error("Socket.IO Redis adapter startup failed", { error });
    process.exitCode = 1;
    return;
  }
  await container.notificationStreamPublisher?.connect().catch((error) => {
    logger.error("Notification stream startup failed", { error });
  });
  await container.notificationRealtimeConsumer?.start().catch((error) => {
    logger.error("Realtime notification startup failed", { error });
  });
  try {
    const connected = await container.database.connectDatabase();
    if (!connected) {
      logger.warn("MONGO_URI is not configured; Workspace will remain not ready");
    } else {
      await container.notificationClient?.drain().catch((error) => {
        logger.error("Notification outbox drain failed", { error });
      });
      await container.sessionService
        ?.retryPendingEscrowReleases("workspace-startup")
        .catch((error) => {
          logger.error("Escrow release recovery failed", { error });
        });
      escrowReleaseRetryTimer = setInterval(() => {
        container.sessionService
          ?.retryPendingEscrowReleases("workspace-retry")
          .catch((error) => {
            logger.error("Escrow release retry failed", { error });
          });
      }, 10000);
      escrowReleaseRetryTimer.unref?.();
      notificationOutboxTimer = setInterval(() => {
        container.notificationClient?.drain().catch((error) => {
          logger.error("Notification outbox retry failed", { error });
        });
      }, 5000);
      notificationOutboxTimer.unref?.();
    }
    server = httpServer.listen(env.port, () => {
      logger.info("Service listening", { port: env.port });
    });
  } catch (error) {
    logger.error("Workspace database startup failed", { error });
    process.exitCode = 1;
  }
};

const shutdown = (signal) => {
  logger.info("Shutdown signal received", { signal });

  if (!server) {
    socketRedisAdapter?.close().finally(() => process.exit());
    return;
  }
  if (notificationOutboxTimer) clearInterval(notificationOutboxTimer);
  if (escrowReleaseRetryTimer) clearInterval(escrowReleaseRetryTimer);
  io.close();
  socketRedisAdapter?.close().catch((error) => {
    logger.error("Socket.IO Redis adapter shutdown failed", { error });
    process.exitCode = 1;
  });
  container.notificationRealtimeConsumer?.stop().catch(() => null);
  server.close((error) => {
    container.notificationStreamPublisher?.close().catch((closeError) => {
      logger.error("Notification stream shutdown failed", { error: closeError });
      process.exitCode = 1;
    });
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
