// services/mentoring-workspace/routes/goal.routes.js
const express = require("express");

const createGoalRouter = ({ controller, authenticate, validations }) => {
  const router = express.Router();

  router.use(authenticate);

  // ── Goal routes ────────────────────────────────────────────────────────────
  router.post(
    "/",
    validations.validateCreateGoal,
    controller.createGoal,
  );
  router.get(
    "/:connectRequestId",
    validations.connectRequestIdParam,
    controller.getGoal,
  );
  router.patch(
    "/:goalId",
    validations.validateUpdateGoal,
    controller.updateGoal,
  );

  // ── Milestone sub-routes ───────────────────────────────────────────────────
  router.post(
    "/:goalId/milestones",
    validations.validateCreateMilestone,
    controller.createMilestone,
  );
  router.patch(
    "/milestones/:milestoneId",
    validations.validateUpdateMilestone,
    controller.updateMilestone,
  );
  router.delete(
    "/milestones/:milestoneId",
    validations.milestoneIdParam,
    controller.deleteMilestone,
  );

  return router;
};

module.exports = createGoalRouter;
