const express = require("express");
const crypto = require("node:crypto");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const errorHandler = require("./middleware/errorHandler");
const createRequireReady = require("./middleware/requireReady");

const createApp = (container = {}) => {
  const app = express();

  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use(express.json());
  app.use((req, res, next) => {
    req.correlationId = req.get("X-Correlation-ID") || crypto.randomUUID();
    res.setHeader("X-Correlation-ID", req.correlationId);
    next();
  });

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

  if (container.authRouter) {
    app.use("/api/v1/admin/auth", container.authRouter);
  }

  if (container.userManagementRouter) {
    app.use(
      "/api/v1/admin/users",
      createRequireReady(container),
      container.userManagementRouter,
    );
  }

  if (container.dashboardRouter) {
    app.use(
      "/api/v1/admin",
      createRequireReady(container),
      container.dashboardRouter,
    );
  }

  if (container.settingsRouter) {
    app.use(
      "/api/v1/admin/settings",
      createRequireReady(container),
      container.settingsRouter,
    );
  }

  if (container.verificationRouter) {
    app.use(
      "/api/v1/admin/mentor-verifications",
      createRequireReady(container),
      container.verificationRouter,
    );
  }

  if (container.reportsRouter) {
    app.use(
      "/api/v1/admin/reports",
      createRequireReady(container),
      container.reportsRouter,
    );
  }

  app.use(errorHandler);

  return app;
};

module.exports = createApp;
