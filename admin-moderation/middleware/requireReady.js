const createRequireReady = (container) => (_req, res, next) => {
  if (container.health?.isReady?.() !== true) {
    return res.status(503).json({
      success: false,
      data: null,
      message: "Admin persistence is not ready",
      error: "Admin persistence is not ready",
      code: "SERVICE_NOT_READY",
    });
  }

  return next();
};

module.exports = createRequireReady;
