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

  if (container.mentorProfileRouter) {
    app.use(
      "/api/v1/mentor-profile",
      createRequireReady(container),
      container.mentorProfileRouter,
    );
  }

  if (container.menteeProfileRouter) {
    app.use(
      "/api/v1/mentee-profile",
      createRequireReady(container),
      container.menteeProfileRouter,
    );
  }

  if (container.availabilityRouter) {
    app.use(
      "/api/v1/availability",
      createRequireReady(container),
      container.availabilityRouter,
    );
  }

  if (container.mentorSearchRouter) {
    app.use(
      "/api/v1/mentors",
      createRequireReady(container),
      container.mentorSearchRouter,
    );
  }

  if (container.uploadRouter) {
    app.use(
      "/api/v1/upload",
      createRequireReady(container),
      container.uploadRouter,
    );
  }

  if (container.googleCalendarRouter) {
    app.use("/api/v1/google-calendar", container.googleCalendarRouter);
  }

  if (container.internalAdminProfileRouter && container.internalAdminServiceAuth) {
    app.use(
      "/internal/v1/admin/profiles",
      container.internalAdminServiceAuth,
      createRequireReady(container),
      container.internalAdminProfileRouter,
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

  if (container.internalAdminVerificationRouter && container.internalAdminServiceAuth) {
    app.use(
      "/internal/v1/admin/mentor-verifications",
      container.internalAdminServiceAuth,
      createRequireReady(container),
      container.internalAdminVerificationRouter,
    );
  }

  app.use(errorHandler);

  return app;
};

module.exports = createApp;
