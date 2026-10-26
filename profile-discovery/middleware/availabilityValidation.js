const ALLOWED_DURATIONS = new Set([30, 45, 60]);
const DAYS = new Set([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);
const COMMUNICATION_FIELDS = new Set([
  "timezone",
  "sessionDurations",
  "weeklyHours",
  "specificDates",
  "googleCalendarConnected",
]);

const invalid = (message, code = "INVALID_AVAILABILITY") => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

const validateTime = (value) =>
  typeof value === "string" && /^([0-1]?\d|2[0-3]):[0-5]\d$/.test(value);

const validateSlots = (slots) => {
  if (!Array.isArray(slots)) throw invalid("slots must be an array.");
  for (const slot of slots) {
    if (!validateTime(slot?.startTime) || !validateTime(slot?.endTime)) {
      throw invalid("Availability slot times must use HH:MM format.");
    }
    if (slot.startTime >= slot.endTime) {
      throw invalid("Availability slot endTime must be after startTime.");
    }
  }
};

const validateBody = (body, { create }) => {
  const unknownField = Object.keys(body || {}).find(
    (field) => !COMMUNICATION_FIELDS.has(field),
  );
  if (unknownField) throw invalid(`Unsupported availability field: ${unknownField}.`);

  if (body?.timezone !== undefined) {
    if (typeof body.timezone !== "string" || !body.timezone.trim()) {
      throw invalid("timezone must be a non-empty string.");
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone }).format();
    } catch {
      throw invalid("timezone must be a valid IANA timezone.");
    }
  }

  if (body?.sessionDurations !== undefined) {
    if (
      !Array.isArray(body.sessionDurations) ||
      body.sessionDurations.length === 0 ||
      body.sessionDurations.some((duration) => !ALLOWED_DURATIONS.has(duration))
    ) {
      throw invalid("sessionDurations must contain only 30, 45, or 60.");
    }
  } else if (create) {
    throw invalid("sessionDurations is required.");
  }

  if (body?.weeklyHours !== undefined) {
    if (!Array.isArray(body.weeklyHours)) throw invalid("weeklyHours must be an array.");
    for (const day of body.weeklyHours) {
      if (!DAYS.has(day?.day) || typeof day.isAvailable !== "boolean") {
        throw invalid("weeklyHours contains an invalid day schedule.");
      }
      validateSlots(day.slots || []);
    }
  }

  if (body?.specificDates !== undefined) {
    if (!Array.isArray(body.specificDates)) throw invalid("specificDates must be an array.");
    for (const date of body.specificDates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date?.date)) {
        throw invalid("specificDates.date must use YYYY-MM-DD format.");
      }
      validateSlots(date.slots || []);
    }
  }

  if (
    body?.googleCalendarConnected !== undefined &&
    typeof body.googleCalendarConnected !== "boolean"
  ) {
    throw invalid("googleCalendarConnected must be a boolean.");
  }
};

const createAvailabilityValidation = (req, _res, next) => {
  try {
    validateBody(req.body, { create: true });
    return next();
  } catch (error) {
    return next(error);
  }
};

const updateAvailabilityValidation = (req, _res, next) => {
  try {
    validateBody(req.body, { create: false });
    return next();
  } catch (error) {
    return next(error);
  }
};

const durationValidation = (req, _res, next) => {
  const duration = Number.parseInt(req.query.duration, 10) || 60;
  if (!ALLOWED_DURATIONS.has(duration)) {
    return next(invalid("Duration must be 30, 45, or 60 minutes.", "INVALID_DURATION"));
  }
  req.availabilityDuration = duration;
  return next();
};

module.exports = {
  createAvailabilityValidation,
  updateAvailabilityValidation,
  durationValidation,
};
