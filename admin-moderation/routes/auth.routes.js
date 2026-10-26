const express = require("express");

const createAuthRouter = ({
  controller,
  authenticate,
  validateLogin,
  requireReady,
}) => {
  const router = express.Router();

  router.post("/login", requireReady, validateLogin, controller.login);
  router.post("/refresh", requireReady, controller.refresh);
  router.post("/logout", controller.logout);

  router.get("/me", requireReady, authenticate, controller.me);

  return router;
};

module.exports = createAuthRouter;
