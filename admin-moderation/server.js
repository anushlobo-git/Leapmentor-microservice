const http = require("node:http");

const createApp = require("./app");
const container = require("./container");
const env = require("./config/env");

const app = createApp(container);
const httpServer = http.createServer(app);

let server;

const startServer = async () => {
  try {
    const connected = await container.database.connectDatabase();
    if (!connected) {
      process.stderr.write(
        "MONGO_URI is not configured; Admin persistence will remain not ready\n",
      );
    }

    server = httpServer.listen(env.port, () => {
      process.stdout.write(`${env.serviceName} service listening on port ${env.port}\n`);
    });
  } catch (error) {
    process.stderr.write(`Admin database startup failed: ${error.message}\n`);
    process.exitCode = 1;
  }
};

const shutdown = (signal) => {
  process.stdout.write(`${signal} received; shutting down\n`);

  if (!server) {
    container.database.closeDatabase().finally(() => process.exit());
    return;
  }

  server.close(async (error) => {
    if (error) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }

    try {
      await container.database.closeDatabase();
    } catch (closeError) {
      process.stderr.write(`${closeError.message}\n`);
      process.exitCode = 1;
    }

    process.exit();
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
