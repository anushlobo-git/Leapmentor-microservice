const express = require("express");

const createSlotLockRouter = ({ controller, authenticate, validations }) => {
  const router = express.Router();
  router.use(authenticate);
  router.post("/lock", validations.validateSlot, controller.lock);
  router.post("/unlock", validations.validateSlot, controller.unlock);
  router.post("/unlock-all", validations.validateUnlockAll, controller.unlockAll);
  router.get("/:mentorId", validations.validateMentorParam, controller.active);
  return router;
};

module.exports = createSlotLockRouter;
