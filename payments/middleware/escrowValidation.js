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

const payAdditionalValidation = (req, _res, next) => {
  const { connectRequestId, sessionRate, slotId, slot } = req.body || {};
  if (!connectRequestId || !sessionRate || (!slotId && !slot)) {
    return next(invalid("connectRequestId, sessionRate, and either slotId or slot are required"));
  }
  if (!OBJECT_ID.test(String(connectRequestId))) {
    return next(invalid("connectRequestId must be a valid ObjectId"));
  }
  if (slotId && !OBJECT_ID.test(String(slotId))) {
    return next(invalid("slotId must be a valid ObjectId"));
  }
  if (!Number.isInteger(Number(sessionRate)) || Number(sessionRate) < 1) {
    return next(invalid("sessionRate must be a positive integer"));
  }
  if (
    !slotId &&
    (!slot.date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(slot.date) ||
      !slot.startTime ||
      !/^([01]?\d|2[0-3]):[0-5]\d$/.test(slot.startTime) ||
      !slot.endTime ||
      !/^([01]?\d|2[0-3]):[0-5]\d$/.test(slot.endTime))
  ) {
    return next(invalid("slot must include a valid date, startTime, and endTime"));
  }
  return next();
};

module.exports = {
  payValidation: bodyValidation(["connectRequestId", "sessionRate", "sessionCount"]),
  payAdditionalValidation,
  requestIdValidation,
};
