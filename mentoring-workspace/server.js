const http = require("node:http");
const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const createApp = require("./app");
const container = require("./container");
const env = require("./config/env");
const configureRedisAdapter = require("./socket/configureRedisAdapter");

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
    process.stderr.write(
      `Socket.IO Redis adapter startup failed: ${error.message}\n`,
    );
    process.exitCode = 1;
    return;
  }
  await container.notificationStreamPublisher?.connect().catch((error) => {
    process.stderr.write(
      `Notification stream startup failed: ${error.message}\n`,
    );
  });
  await container.notificationRealtimeConsumer?.start().catch((error) => {
    process.stderr.write(
      `Realtime notification startup failed: ${error.message}\n`,
    );
  });
  try {
    const connected = await container.database.connectDatabase();
    if (!connected) {
      process.stderr.write(
        "MONGO_URI is not configured; Workspace will remain not ready\n",
      );
    } else {
      await container.notificationClient?.drain().catch((error) => {
        process.stderr.write(
          `Notification outbox drain failed: ${error.message}\n`,
        );
      });
      await container.sessionService
        ?.retryPendingEscrowReleases("workspace-startup")
        .catch((error) => {
          process.stderr.write(
            `Escrow release recovery failed: ${error.message}\n`,
          );
        });
      escrowReleaseRetryTimer = setInterval(() => {
        container.sessionService
          ?.retryPendingEscrowReleases("workspace-retry")
          .catch((error) => {
            process.stderr.write(
              `Escrow release retry failed: ${error.message}\n`,
            );
          });
      }, 10000);
      escrowReleaseRetryTimer.unref?.();
      notificationOutboxTimer = setInterval(() => {
        container.notificationClient?.drain().catch((error) => {
          process.stderr.write(
            `Notification outbox retry failed: ${error.message}\n`,
          );
        });
      }, 5000);
      notificationOutboxTimer.unref?.();
    }
    server = httpServer.listen(env.port, () => {
      process.stdout.write(
        `${env.serviceName} service listening on port ${env.port}\n`,
      );
    });
  } catch (error) {
    process.stderr.write(
      `Workspace database startup failed: ${error.message}\n`,
    );
    process.exitCode = 1;
  }
};

const shutdown = (signal) => {
  process.stdout.write(`${signal} received; shutting down\n`);

  if (!server) {
    socketRedisAdapter?.close().finally(() => process.exit());
    return;
  }
  if (notificationOutboxTimer) clearInterval(notificationOutboxTimer);
  if (escrowReleaseRetryTimer) clearInterval(escrowReleaseRetryTimer);
  io.close();
  socketRedisAdapter?.close().catch((error) => {
    process.stderr.write(
      `Socket.IO Redis adapter shutdown failed: ${error.message}\n`,
    );
    process.exitCode = 1;
  });
  container.notificationRealtimeConsumer?.stop().catch(() => null);
  server.close((error) => {
    container.notificationStreamPublisher?.close().catch((closeError) => {
      process.stderr.write(`${closeError.message}\n`);
      process.exitCode = 1;
    });
    container.database
      .closeDatabase()
      .catch((closeError) => {
        process.stderr.write(`${closeError.message}\n`);
        process.exitCode = 1;
      })
      .finally(() => {
        if (error) {
          process.stderr.write(`${error.message}\n`);
          process.exitCode = 1;
        }
        process.exit();
      });
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
