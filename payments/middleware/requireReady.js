const createRequireReady = (container) => (req, res, next) => {
  if (container.health?.isReady?.() !== true) {
    return res.status(503).json({
      error: "Payments persistence is not ready",
      code: "SERVICE_NOT_READY",
    });
  }

  return next();
};

module.exports = createRequireReady;
