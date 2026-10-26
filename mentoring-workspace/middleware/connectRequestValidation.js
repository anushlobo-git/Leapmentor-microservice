const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_CONNECT_REQUEST";
  return error;
};

const validateId = (req, _res, next) =>
  OBJECT_ID.test(String(req.params.id))
    ? next()
    : next(invalid("id must be a valid ObjectId"));

const validateCreate = (req, _res, next) => {
  try {
    if (!OBJECT_ID.test(String(req.body?.mentorId || ""))) throw invalid("mentorId must be a valid ObjectId");
    if (!Array.isArray(req.body?.selectedSlots) || req.body.selectedSlots.length < 1 || req.body.selectedSlots.length > 5) throw invalid("selectedSlots must contain 1 to 5 slots");
    return next();
  } catch (error) { return next(error); }
};

const validateResponse = (req, _res, next) => {
  try {
    if (!OBJECT_ID.test(String(req.params.id))) throw invalid("id must be a valid ObjectId");
    if (!['accepted', 'rejected'].includes(req.body?.status)) throw invalid("status must be accepted or rejected");
    return next();
  } catch (error) { return next(error); }
};

module.exports = { validateId, validateCreate, validateResponse };
