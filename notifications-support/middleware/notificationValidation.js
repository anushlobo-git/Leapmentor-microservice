const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const validateNotificationId = (req, _res, next) => {
  if (!OBJECT_ID.test(String(req.params.id || ""))) {
    const error = new Error("Notification id must be a valid ObjectId");
    error.statusCode = 400;
    error.code = "INVALID_NOTIFICATION_ID";
    return next(error);
  }
  return next();
};

module.exports = { validateNotificationId };
