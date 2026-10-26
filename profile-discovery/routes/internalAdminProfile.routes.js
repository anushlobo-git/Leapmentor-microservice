const express = require("express");

const createInternalAdminProfileRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/", controller.getProfiles);
  return router;
};

module.exports = createInternalAdminProfileRouter;
