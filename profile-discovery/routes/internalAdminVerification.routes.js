const express = require("express");

const createInternalAdminVerificationRouter = ({ controller }) => {
  const router = express.Router();
  router.get("/", controller.list);
  router.get("/:mentorProfileId", controller.getById);
  router.patch("/:mentorProfileId/verify", controller.verify);
  router.patch("/:mentorProfileId/revoke", controller.revoke);
  return router;
};

module.exports = createInternalAdminVerificationRouter;
