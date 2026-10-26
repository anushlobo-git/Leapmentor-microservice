const express = require("express");

const createInternalUserRouter = ({ internalUserController }) => {
  const router = express.Router();
  router.get("/", internalUserController.searchUsers);
  router.get("/:id", internalUserController.getUserSummary);
  return router;
};

module.exports = createInternalUserRouter;
