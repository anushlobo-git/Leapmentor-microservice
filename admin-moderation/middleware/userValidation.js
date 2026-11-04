const mongoose = require("mongoose");
const AppError = require("../utils/AppError");

const validateUsersQuery = (req, _res, next) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const { role, deleted } = req.query;

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return next(new AppError("Page must be at least 1 and limit must be between 1 and 100.", 400, "INVALID_USER_QUERY"));
  }
  if (role && !["mentor", "mentee"].includes(role)) {
    return next(new AppError("Role must be mentor or mentee.", 400, "INVALID_USER_QUERY"));
  }
  if (deleted && !["true", "false"].includes(deleted)) {
    return next(new AppError("Deleted must be true or false.", 400, "INVALID_USER_QUERY"));
  }

  req.query.page = String(page);
  req.query.limit = String(limit);
  return next();
};

const validateUserId = (req, _res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return next(new AppError("Invalid user id.", 400, "INVALID_USER_ID"));
  }
  return next();
};

module.exports = { validateUsersQuery, validateUserId };
