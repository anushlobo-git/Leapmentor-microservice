const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const invalid = (message, code = "INVALID_CALENDAR_QUERY") => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

const validDate = (value) => {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

const handleCallbackValidation = (req, _res, next) => {
  const { code, state, error } = req.query || {};
  if (error) return next();
  if (typeof code !== "string" || typeof state !== "string" || !code || !state) {
    return next(invalid("Google Calendar callback requires code and state."));
  }
  return next();
};

const getCalendarIntervalValidation = (req, _res, next) => {
  const { startDate, endDate } = req.query || {};
  if (!validDate(startDate || "") || !validDate(endDate || "")) {
    return next(invalid("startDate and endDate must be valid YYYY-MM-DD dates."));
  }
  if (startDate > endDate) {
    return next(invalid("startDate cannot be after endDate."));
  }
  return next();
};

module.exports = {
  handleCallbackValidation,
  getCalendarIntervalValidation,
};
