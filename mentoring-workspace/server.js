const http = require("node:http");
const { Server } = require("socket.io");

const createApp = require("./app");
const container = require("./container");
const env = require("./config/env");

const app = createApp(container);
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: env.clientUrl, credentials: true },
});
io.use(container.socketAuth);
container.createMessageSocketHandler({
  io,
  messageService: container.messageService,
  messageRepository: container.messageRepository,
  connectRequestRepository: container.connectRequestRepository,
  notificationClient: container.notificationClient,
});

let server;

const startServer = async () => {
  await container.notificationStreamPublisher?.connect().catch((error) => {
    process.stderr.write(`Notification stream startup failed: ${error.message}\n`);
  });
  try {
    const connected = await container.database.connectDatabase();
    if (!connected) {
      process.stderr.write(
        "MONGO_URI is not configured; Workspace will remain not ready\n",
      );
    }
    server = httpServer.listen(env.port, () => {
      process.stdout.write(`${env.serviceName} service listening on port ${env.port}\n`);
    });
  } catch (error) {
    process.stderr.write(`Workspace database startup failed: ${error.message}\n`);
    process.exitCode = 1;
  }
};

const shutdown = (signal) => {
  process.stdout.write(`${signal} received; shutting down\n`);

  if (!server) return process.exit(0);
  io.close();
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
