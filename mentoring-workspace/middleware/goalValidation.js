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

// Express 5 leaves req.body undefined when a request has no body. Normalise it
// so validators and controllers can read fields without throwing a TypeError.
const normaliseBody = (req) => {
  if (req.body === undefined || req.body === null) req.body = {};
  return req.body;
};

const assertOptionalString = (value, field) => {
  if (value !== undefined && value !== null && typeof value !== "string")
    throw invalid(`${field} must be a string`);
};

const assertOptionalDate = (value, field) => {
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "string" || !DATE.test(value))
    throw invalid(`${field} must be in YYYY-MM-DD format`);
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
    const body = normaliseBody(req);
    if (!OBJECT_ID.test(String(body.connectRequestId || "")))
      throw invalid("connectRequestId must be a valid ObjectId");
    if (typeof body.title !== "string" || !body.title.trim())
      throw invalid("title is required");
    assertOptionalString(body.description, "description");
    assertOptionalDate(body.startDate, "startDate");
    assertOptionalDate(body.endDate, "endDate");
    return next();
  } catch (e) {
    return next(e);
  }
};

const validateUpdateGoal = (req, _res, next) => {
  try {
    const body = normaliseBody(req);
    if (!OBJECT_ID.test(String(req.params.goalId || "")))
      throw invalid("goalId must be a valid ObjectId");
    if (
      body.title !== undefined &&
      (typeof body.title !== "string" || !body.title.trim())
    )
      throw invalid("title cannot be empty");
    if (body.description !== undefined && typeof body.description !== "string")
      throw invalid("description must be a string");
    if (body.status !== undefined && !VALID_STATUSES.has(body.status))
      throw invalid("status must be active, completed, or abandoned");
    assertOptionalDate(body.startDate, "startDate");
    assertOptionalDate(body.endDate, "endDate");
    return next();
  } catch (e) {
    return next(e);
  }
};

const validateCreateMilestone = (req, _res, next) => {
  try {
    const body = normaliseBody(req);
    if (!OBJECT_ID.test(String(req.params.goalId || "")))
      throw invalid("goalId must be a valid ObjectId");
    if (typeof body.title !== "string" || !body.title.trim())
      throw invalid("title is required");
    assertOptionalString(body.description, "description");
    assertOptionalDate(body.dueDate, "dueDate");
    return next();
  } catch (e) {
    return next(e);
  }
};

const validateUpdateMilestone = (req, _res, next) => {
  try {
    const body = normaliseBody(req);
    if (!OBJECT_ID.test(String(req.params.milestoneId || "")))
      throw invalid("milestoneId must be a valid ObjectId");
    if (
      body.title !== undefined &&
      (typeof body.title !== "string" || !body.title.trim())
    )
      throw invalid("title cannot be empty");
    if (body.description !== undefined && typeof body.description !== "string")
      throw invalid("description must be a string");
    if (body.isCompleted !== undefined && typeof body.isCompleted !== "boolean")
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
