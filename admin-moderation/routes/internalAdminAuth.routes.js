const express = require("express");

const createInternalAdminAuthRouter = ({ controller }) => {
  const router = express.Router();
  router.post("/validate-session", controller.validateSession);
  return router;
};

module.exports = createInternalAdminAuthRouter;
