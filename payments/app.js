const express = require("express");
const env = require("./config/env");
const createRequireReady = require("./middleware/requireReady");
const errorHandler = require("./middleware/errorHandler");

const createApp = (container = {}) => {
  const app = express();

  app.disable("x-powered-by");
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

  if (container.internalWalletRouter && container.internalServiceAuth) {
    app.use(
      "/internal/v1/wallets",
      container.internalServiceAuth,
      createRequireReady(container),
      container.internalWalletRouter,
    );
  }

  if (container.internalSettingsRouter && container.internalServiceAuth) {
    app.use(
      "/internal/v1/settings",
      container.internalServiceAuth,
      createRequireReady(container),
      container.internalSettingsRouter,
    );
  }

  if (container.internalRefundRouter && container.internalServiceAuth) {
    app.use(
      "/internal/v1/refunds",
      container.internalServiceAuth,
      createRequireReady(container),
      container.internalRefundRouter,
    );
  }

  if (container.walletRouter) {
    app.use(
      "/api/v1/escrow",
      createRequireReady(container),
      container.walletRouter,
    );
  }

  if (container.escrowRouter) {
    app.use(
      "/api/v1/escrow",
      createRequireReady(container),
      container.escrowRouter,
    );
  }

  app.use(errorHandler);

  return app;
};

module.exports = createApp;
