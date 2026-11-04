const express = require("express");

const createInternalSettingsRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/commission", controller.getCommission);
  router.put("/commission", controller.updateCommission);
  return router;
};

module.exports = createInternalSettingsRouter;
