// services/mentoring-workspace/middleware/noteValidation.js

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const MAX_TITLE_LENGTH = 200;

const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_NOTE_REQUEST";
  return error;
};

// Express 5 leaves req.body undefined when a request has no parsed body.
const normaliseBody = (req) => {
  if (req.body === undefined || req.body === null) req.body = {};
  return req.body;
};

const connectRequestIdParam = (req, _res, next) =>
  OBJECT_ID.test(String(req.params.connectRequestId || ""))
    ? next()
    : next(invalid("connectRequestId must be a valid ObjectId"));

const noteIdParam = (req, _res, next) =>
  OBJECT_ID.test(String(req.params.id || ""))
    ? next()
    : next(invalid("Note id must be a valid ObjectId"));

/**
 * Validates the multipart text fields of POST /notes/upload. Runs after
 * multer, so `req.body` holds the fields as strings. `isPrivate` accepts a
 * boolean or the strings "true"/"false" and is normalised to a boolean.
 */
const validateUpload = (req, _res, next) => {
  try {
    const body = normaliseBody(req);

    if (!OBJECT_ID.test(String(body.connectRequestId || ""))) {
      throw invalid("connectRequestId must be a valid ObjectId");
    }
    if (body.title !== undefined) {
      if (typeof body.title !== "string")
        throw invalid("title must be a string");
      if (body.title.trim().length > MAX_TITLE_LENGTH) {
        throw invalid(`title cannot exceed ${MAX_TITLE_LENGTH} characters`);
      }
    }
    if (body.isPrivate !== undefined) {
      const allowed = [true, false, "true", "false"];
      if (!allowed.includes(body.isPrivate)) {
        throw invalid("isPrivate must be true or false");
      }
      body.isPrivate = body.isPrivate === true || body.isPrivate === "true";
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { connectRequestIdParam, noteIdParam, validateUpload };
