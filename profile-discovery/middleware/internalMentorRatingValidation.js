const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_MENTOR_RATING";
  return error;
};

const validateRating = (req, _res, next) => {
  try {
    if (!OBJECT_ID.test(String(req.params.userId || ""))) {
      throw invalid("userId must be a valid ObjectId");
    }
    if (typeof req.body?.avgRating !== "number" || !Number.isFinite(req.body.avgRating)) {
      throw invalid("avgRating must be a number");
    }
    if (req.body.avgRating < 0 || req.body.avgRating > 5) {
      throw invalid("avgRating must be between 0 and 5");
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = validateRating;
