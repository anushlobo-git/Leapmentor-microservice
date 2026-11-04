// services/mentoring-workspace/middleware/privateNoteValidation.js

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20000;

const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_PRIVATE_NOTE_REQUEST";
  return error;
};

// Express 5 leaves req.body undefined when a request has no body.
const normaliseBody = (req) => {
  if (req.body === undefined || req.body === null) req.body = {};
  return req.body;
};

const assertOptionalText = (value, field, maxLength) => {
  if (value === undefined) return;
  if (typeof value !== "string") throw invalid(`${field} must be a string`);
  if (value.length > maxLength)
    throw invalid(`${field} cannot exceed ${maxLength} characters`);
};

const connectRequestIdParam = (req, _res, next) =>
  OBJECT_ID.test(String(req.params.connectRequestId || ""))
    ? next()
    : next(invalid("connectRequestId must be a valid ObjectId"));

const noteIdParam = (req, _res, next) =>
  OBJECT_ID.test(String(req.params.id || ""))
    ? next()
    : next(invalid("Note id must be a valid ObjectId"));

const validateCreate = (req, _res, next) => {
  try {
    const body = normaliseBody(req);
    if (!OBJECT_ID.test(String(body.connectRequestId || "")))
      throw invalid("connectRequestId must be a valid ObjectId");
    assertOptionalText(body.title, "title", MAX_TITLE_LENGTH);
    assertOptionalText(body.content, "content", MAX_CONTENT_LENGTH);
    return next();
  } catch (error) {
    return next(error);
  }
};

const validateUpdate = (req, _res, next) => {
  try {
    const body = normaliseBody(req);
    if (!OBJECT_ID.test(String(req.params.id || "")))
      throw invalid("Note id must be a valid ObjectId");
    assertOptionalText(body.title, "title", MAX_TITLE_LENGTH);
    assertOptionalText(body.content, "content", MAX_CONTENT_LENGTH);
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  connectRequestIdParam,
  noteIdParam,
  validateCreate,
  validateUpdate,
};
