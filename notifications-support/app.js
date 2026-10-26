const express = require("express");
const crypto = require("node:crypto");
const env = require("./config/env");
const createRequireReady = require("./middleware/requireReady");
const errorHandler = require("./middleware/errorHandler");

const createApp = (container = {}) => {
  const app = express();

  app.disable("x-powered-by");
  app.use((req, res, next) => {
    req.correlationId = req.get("X-Correlation-ID") || crypto.randomUUID();
    res.setHeader("X-Correlation-ID", req.correlationId);
    next();
  });
  app.use(express.json());

  app.get("/health/live", (_req, res) => {
    res.status(200).json({ status: "ok", service: env.serviceName });
  });

  app.get("/health/ready", (_req, res) => {
    const ready = container.health?.isReady?.() === true;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not-ready",
      service: env.serviceName,
    });
  });

  app.get("/", (_req, res) => {
    res.status(200).json({ service: env.serviceName, status: "running" });
  });

  if (container.internalNotificationRouter && container.internalServiceAuth) {
    app.use(
      "/internal/v1/notifications",
      container.internalServiceAuth,
      createRequireReady(container),
      container.internalNotificationRouter,
    );
  }

  if (container.notificationRouter) {
    app.use(
      "/api/v1/notifications",
      createRequireReady(container),
      container.notificationRouter,
    );
  }

  if (container.supportRouter) {
    app.use("/api/v1/support", createRequireReady(container), container.supportRouter);
  }

  if (container.aiRouter) {
    app.use("/api/v1/ai", container.aiRouter);
  }

  app.use(errorHandler);

  return app;
};

module.exports = createApp;
