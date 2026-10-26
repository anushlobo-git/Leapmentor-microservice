const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const validateNotificationEvent = (req, _res, next) => {
  const body = req.body || {};
  const validRecipient = OBJECT_ID.test(String(body.recipient || ""));
  const validEventId = typeof body.sourceEventId === "string" && body.sourceEventId.trim().length > 0 && body.sourceEventId.length <= 200;
  const validTitle = typeof body.title === "string" && body.title.trim().length > 0 && body.title.length <= 200;
  const validMessage = typeof body.message === "string" && body.message.trim().length > 0 && body.message.length <= 1000;
  if (!validRecipient || !validEventId || !validTitle || !validMessage || typeof body.type !== "string") {
    const error = new Error("Invalid notification event payload");
    error.statusCode = 400;
    error.code = "INVALID_NOTIFICATION_EVENT";
    return next(error);
  }
  return next();
};

module.exports = { validateNotificationEvent };
