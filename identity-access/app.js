const express = require("express");
const crypto = require("node:crypto");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const createRequireReady = require("./middleware/requireReady");
const errorHandler = require("./middleware/errorHandler");

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
    res.status(200).json({
      status: "ok",
      service: env.serviceName,
    });
  });

  app.get("/health/ready", (_req, res) => {
    const ready = container.health?.isReady?.() === true;

    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not-ready",
      service: env.serviceName,
    });
  });

  app.get("/", (_req, res) => {
    res.status(200).json({
      service: env.serviceName,
      status: "running",
    });
  });

  // Logout only clears a browser cookie. Keep it available even when MongoDB
  // is unavailable; all stateful auth operations remain readiness-protected.
  if (container.authController?.logout) {
    app.post("/api/v1/auth/logout", container.authController.logout);
  }

  // LinkedIn browser redirect/callback are stateless transport steps. Keep
  // them available while Identity persistence is unavailable; the token
  // exchange and all account mutations remain readiness-protected below.
  if (container.oauthPublicRouter) {
    app.use("/api/v1/auth", container.oauthPublicRouter);
  }

  if (container.internalUserRouter && container.internalServiceAuth) {
    app.use(
      "/internal/v1/users",
      container.internalServiceAuth,
      createRequireReady(container),
      container.internalUserRouter,
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

  if (container.authRouter) {
    app.use(
      "/api/v1/auth",
      createRequireReady(container),
      container.authRouter,
    );
  }

  if (container.verificationRouter) {
    app.use(
      "/api/v1/verification",
      createRequireReady(container),
      container.verificationRouter,
    );
  }

  if (container.forgotPasswordRouter) {
    app.use(
      "/api/v1/auth",
      createRequireReady(container),
      container.forgotPasswordRouter,
    );
  }

  if (container.userRouter) {
    app.use(
      "/api/v1/users",
      createRequireReady(container),
      container.userRouter,
    );
  }

  app.use(errorHandler);

  return app;
};

module.exports = createApp;
