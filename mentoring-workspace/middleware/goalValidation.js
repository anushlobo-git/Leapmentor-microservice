// services/mentoring-workspace/middleware/goalValidation.js

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = new Set(["active", "completed", "abandoned"]);

const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_GOAL_REQUEST";
  return error;
};

// ── param validators ─────────────────────────────────────────────────────────

const connectRequestIdParam = (req, _res, next) =>
  OBJECT_ID.test(String(req.params.connectRequestId || ""))
    ? next()
    : next(invalid("connectRequestId must be a valid ObjectId"));

const goalIdParam = (req, _res, next) =>
  OBJECT_ID.test(String(req.params.goalId || ""))
    ? next()
    : next(invalid("goalId must be a valid ObjectId"));

const milestoneIdParam = (req, _res, next) =>
  OBJECT_ID.test(String(req.params.milestoneId || ""))
    ? next()
    : next(invalid("milestoneId must be a valid ObjectId"));

// ── body validators ───────────────────────────────────────────────────────────

const validateCreateGoal = (req, _res, next) => {
  try {
    if (!OBJECT_ID.test(String(req.body?.connectRequestId || "")))
      throw invalid("connectRequestId must be a valid ObjectId");
    if (!req.body?.title?.trim())
      throw invalid("title is required");
    if (req.body.startDate !== undefined && req.body.startDate !== null && !DATE.test(req.body.startDate))
      throw invalid("startDate must be in YYYY-MM-DD format");
    if (req.body.endDate !== undefined && req.body.endDate !== null && !DATE.test(req.body.endDate))
      throw invalid("endDate must be in YYYY-MM-DD format");
    return next();
  } catch (e) {
    return next(e);
  }
};

const validateUpdateGoal = (req, _res, next) => {
  try {
    if (!OBJECT_ID.test(String(req.params.goalId || "")))
      throw invalid("goalId must be a valid ObjectId");
    if (req.body.title !== undefined && !req.body.title.trim())
      throw invalid("title cannot be empty");
    if (req.body.status !== undefined && !VALID_STATUSES.has(req.body.status))
      throw invalid("status must be active, completed, or abandoned");
    if (req.body.startDate !== undefined && req.body.startDate !== null && !DATE.test(req.body.startDate))
      throw invalid("startDate must be in YYYY-MM-DD format");
    if (req.body.endDate !== undefined && req.body.endDate !== null && !DATE.test(req.body.endDate))
      throw invalid("endDate must be in YYYY-MM-DD format");
    return next();
  } catch (e) {
    return next(e);
  }
};

const validateCreateMilestone = (req, _res, next) => {
  try {
    if (!OBJECT_ID.test(String(req.params.goalId || "")))
      throw invalid("goalId must be a valid ObjectId");
    if (!req.body?.title?.trim())
      throw invalid("title is required");
    if (req.body.dueDate !== undefined && req.body.dueDate !== null && !DATE.test(req.body.dueDate))
      throw invalid("dueDate must be in YYYY-MM-DD format");
    return next();
  } catch (e) {
    return next(e);
  }
};

const validateUpdateMilestone = (req, _res, next) => {
  try {
    if (!OBJECT_ID.test(String(req.params.milestoneId || "")))
      throw invalid("milestoneId must be a valid ObjectId");
    if (req.body.title !== undefined && !req.body.title.trim())
      throw invalid("title cannot be empty");
    if (req.body.isCompleted !== undefined && typeof req.body.isCompleted !== "boolean")
      throw invalid("isCompleted must be a boolean");
    return next();
  } catch (e) {
    return next(e);
  }
};

module.exports = {
  connectRequestIdParam,
  goalIdParam,
  milestoneIdParam,
  validateCreateGoal,
  validateUpdateGoal,
  validateCreateMilestone,
  validateUpdateMilestone,
};
