const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_FEEDBACK_REQUEST";
  return error;
};

const normaliseBody = (req) => {
  if (!req.body || typeof req.body !== "object") req.body = {};
  return req.body;
};

const validateConnectRequestId = (value) => {
  if (!OBJECT_ID.test(String(value || ""))) {
    throw invalid("connectRequestId must be a valid ObjectId");
  }
};

const createFeedbackValidation = (req, _res, next) => {
  try {
    const body = normaliseBody(req);
    validateConnectRequestId(body.connectRequestId);
    if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
      throw invalid("rating must be a whole number between 1 and 5");
    }
    if (body.comment !== undefined && body.comment !== null) {
      if (typeof body.comment !== "string") throw invalid("comment must be a string");
      if (body.comment.length > 1000) throw invalid("comment cannot exceed 1000 characters");
    }
    if (
      body.slotIndex !== undefined &&
      (!Number.isInteger(body.slotIndex) || body.slotIndex < 0)
    ) {
      throw invalid("slotIndex must be a non-negative integer");
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const getFeedbackValidation = (req, _res, next) => {
  try {
    validateConnectRequestId(req.params.connectRequestId);
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { createFeedbackValidation, getFeedbackValidation };
