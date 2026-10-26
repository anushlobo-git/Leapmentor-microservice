const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = "INVALID_MENTOR_SEARCH";
  return error;
};

const numeric = (value, label, { integer = false, min = 0, max } = {}) => {
  if (value === undefined || value === "") return;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) {
    throw invalid(`${label} must be a valid ${integer ? "integer" : "number"}.`);
  }
  if (parsed < min || (max !== undefined && parsed > max)) {
    throw invalid(`${label} is outside the allowed range.`);
  }
};

const searchMentorsValidation = (req, _res, next) => {
  try {
    const query = req.query || {};
    const allowed = new Set([
      "skill",
      "name",
      "industry",
      "minPrice",
      "maxPrice",
      "minRating",
      "minExperience",
      "maxExperience",
      "page",
      "limit",
    ]);
    const unknown = Object.keys(query).find((key) => !allowed.has(key));
    if (unknown) throw invalid(`Unsupported mentor search field: ${unknown}.`);

    for (const key of ["skill", "name", "industry"]) {
      if (query[key] !== undefined && typeof query[key] !== "string") {
        throw invalid(`${key} must be a string.`);
      }
    }
    numeric(query.minPrice, "minPrice");
    numeric(query.maxPrice, "maxPrice");
    numeric(query.minRating, "minRating", { max: 5 });
    numeric(query.minExperience, "minExperience", { integer: true, max: 60 });
    numeric(query.maxExperience, "maxExperience", { integer: true, max: 60 });
    numeric(query.page, "page", { integer: true, min: 1 });
    numeric(query.limit, "limit", { integer: true, min: 1, max: 20 });
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { searchMentorsValidation };
