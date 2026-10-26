const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_ESCROW_REQUEST";
  return error;
};

const bodyValidation = (fields) => (req, _res, next) => {
  try {
    for (const field of fields) {
      if (req.body?.[field] === undefined || req.body?.[field] === "") {
        throw invalid(`${field} is required`);
      }
    }
    if (!OBJECT_ID.test(String(req.body.connectRequestId))) {
      throw invalid("connectRequestId must be a valid ObjectId");
    }
    if (fields.includes("slotId") && !OBJECT_ID.test(String(req.body.slotId))) {
      throw invalid("slotId must be a valid ObjectId");
    }
    for (const field of ["sessionRate", "sessionCount"]) {
      if (fields.includes(field) && (!Number.isInteger(Number(req.body[field])) || Number(req.body[field]) < 1)) {
        throw invalid(`${field} must be a positive integer`);
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const requestIdValidation = (req, _res, next) => {
  if (!OBJECT_ID.test(String(req.params.requestId))) return next(invalid("requestId must be a valid ObjectId"));
  return next();
};

module.exports = {
  payValidation: bodyValidation(["connectRequestId", "sessionRate", "sessionCount"]),
  payAdditionalValidation: bodyValidation(["connectRequestId", "sessionRate", "slotId"]),
  requestIdValidation,
};
