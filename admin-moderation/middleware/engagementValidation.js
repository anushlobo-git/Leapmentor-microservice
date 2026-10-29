const AppError = require("../utils/AppError");

const ALLOWED_STATUSES = new Set([
  "pending",
  "accepted",
  "rejected",
  "referred",
  "ongoing",
  "completed",
]);

const isValidDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  const dateOnly = value.slice(0, 10);
  const normalizedDate = new Date(`${dateOnly}T00:00:00.000Z`)
    .toISOString()
    .slice(0, 10);
  return !Number.isNaN(date.getTime()) && normalizedDate === dateOnly;
};

const validateEngagementQuery = (req, _res, next) => {
  const { status, search, dateFrom, dateTo, page, limit } = req.query;
  const pageNumber = Number(page || 1);
  const limitNumber = Number(limit || 15);
  if (status && !ALLOWED_STATUSES.has(status)) {
    return next(
      new AppError(
        "Invalid engagement status",
        400,
        "INVALID_ENGAGEMENT_QUERY",
      ),
    );
  }
  if (search !== undefined && typeof search !== "string") {
    return next(
      new AppError(
        "Invalid engagement search",
        400,
        "INVALID_ENGAGEMENT_QUERY",
      ),
    );
  }
  if (
    (dateFrom && !isValidDate(dateFrom)) ||
    (dateTo && !isValidDate(dateTo))
  ) {
    return next(
      new AppError(
        "Engagement dates must be valid ISO dates",
        400,
        "INVALID_ENGAGEMENT_QUERY",
      ),
    );
  }
  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    !Number.isInteger(limitNumber) ||
    limitNumber < 1 ||
    limitNumber > 100
  ) {
    return next(
      new AppError(
        "Page must be at least 1 and limit must be between 1 and 100",
        400,
        "INVALID_ENGAGEMENT_QUERY",
      ),
    );
  }
  return next();
};

module.exports = validateEngagementQuery;
