const express = require("express");

const createUserRouter = ({ userController, authenticate, validations }) => {
  const router = express.Router();

  router.use(authenticate);

  router.get("/me", userController.getMe);
  router.patch("/me/roles", validations.addRoleValidation, userController.addRole);

  return router;
};

module.exports = createUserRouter;
