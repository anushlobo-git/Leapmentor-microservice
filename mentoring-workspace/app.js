const express = require("express");
const env = require("./config/env");
const crypto = require("node:crypto");
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

  if (container.internalAvailabilityRouter && container.internalServiceAuth) {
    app.use(
      "/internal/v1/availability",
      container.internalServiceAuth,
      createRequireReady(container),
      container.internalAvailabilityRouter,
    );
  }

  if (container.internalPaymentRouter && container.internalServiceAuth) {
    app.use(
      "/internal/v1/connect-requests",
      container.internalServiceAuth,
      createRequireReady(container),
      container.internalPaymentRouter,
    );
  }

  if (container.internalAdminUserRouter && container.internalAdminServiceAuth) {
    app.use(
      "/internal/v1/admin/users",
      container.internalAdminServiceAuth,
      createRequireReady(container),
      container.internalAdminUserRouter,
    );
  }

  if (container.internalAdminStatsRouter && container.internalAdminServiceAuth) {
    app.use(
      "/internal/v1/admin",
      container.internalAdminServiceAuth,
      createRequireReady(container),
      container.internalAdminStatsRouter,
    );
  }

  if (container.internalAdminReportsRouter && container.internalAdminServiceAuth) {
    app.use(
      "/internal/v1/admin/reports",
      container.internalAdminServiceAuth,
      createRequireReady(container),
      container.internalAdminReportsRouter,
    );
  }

  if (container.connectRequestRouter) {
    app.use(
      "/api/v1/connect-requests",
      createRequireReady(container),
      container.connectRequestRouter,
    );
  }

  if (container.slotLockRouter) {
    app.use(
      "/api/v1/slot-locks",
      createRequireReady(container),
      container.slotLockRouter,
    );
  }

  if (container.sessionRouter) {
    app.use(
      "/api/v1/sessions",
      createRequireReady(container),
      container.sessionRouter,
    );
  }

  if (container.messageRouter) {
    app.use(
      "/api/v1/messages",
      createRequireReady(container),
      container.messageRouter,
    );
  }

  app.use(errorHandler);

  return app;
};

module.exports = createApp;
