const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateCreateMessage = (req, _res, next) => {
  const body = req.body || {};
  if (!EMAIL.test(String(body.email || "")) || !String(body.subject || "").trim() || !String(body.message || "").trim() || String(body.subject).length > 200 || String(body.message).length > 5000 || (body.role && !["mentor", "mentee", "user"].includes(body.role))) {
    const error = new Error("Invalid support ticket payload");
    error.statusCode = 400;
    error.code = "INVALID_SUPPORT_TICKET";
    return next(error);
  }
  return next();
};

const validateTicketId = (req, _res, next) => {
  if (!OBJECT_ID.test(String(req.params.id || ""))) {
    const error = new Error("Support ticket id must be a valid ObjectId");
    error.statusCode = 400;
    error.code = "INVALID_SUPPORT_TICKET_ID";
    return next(error);
  }
  return next();
};

module.exports = { validateCreateMessage, validateTicketId };
