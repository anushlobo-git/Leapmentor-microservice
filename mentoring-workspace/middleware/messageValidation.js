const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const validateConnectRequestId = (req, _res, next) => {
  if (!OBJECT_ID.test(String(req.params.connectRequestId || ""))) {
    const error = new Error("connectRequestId must be a valid ObjectId");
    error.statusCode = 400;
    error.code = "INVALID_MESSAGE_CONTEXT";
    return next(error);
  }
  return next();
};

module.exports = { validateConnectRequestId };
