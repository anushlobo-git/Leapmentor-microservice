const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_SLOT_LOCK";
  return error;
};

const validateSlot = (req, _res, next) => {
  try {
    const { mentorId, date, startTime, endTime } = req.body || {};
    if (!OBJECT_ID.test(String(mentorId || ""))) throw invalid("mentorId must be a valid ObjectId");
    if (!DATE.test(String(date || ""))) throw invalid("date must be YYYY-MM-DD");
    if (!TIME.test(String(startTime || "")) || !TIME.test(String(endTime || ""))) throw invalid("times must be HH:MM");
    return next();
  } catch (error) { return next(error); }
};

const validateUnlockAll = (req, _res, next) => {
  if (req.body?.mentorId && !OBJECT_ID.test(String(req.body.mentorId))) return next(invalid("mentorId must be a valid ObjectId"));
  return next();
};

const validateMentorParam = (req, _res, next) =>
  OBJECT_ID.test(String(req.params.mentorId || "")) ? next() : next(invalid("mentorId must be a valid ObjectId"));

module.exports = { validateSlot, validateUnlockAll, validateMentorParam };
