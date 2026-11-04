const express = require("express");

const createSettingsRouter = ({ controller, authenticate, validation }) => {
  const router = express.Router();
  router.use(authenticate);
  router.get("/overview", controller.getOverview);
  router.post("/add-admin", validation.validateAddAdmin, controller.addAdmin);
  router.put("/change-password", validation.validateChangePassword, controller.changePassword);
  router.get("/commission", controller.getCommission);
  router.put("/commission", validation.validateCommission, controller.updateCommission);
  return router;
};

module.exports = createSettingsRouter;
