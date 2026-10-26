const VALID_COMMUNICATION_PREFERENCES = [
  "Chat",
  "Email",
  "Video Call",
  "Phone Call",
  "In-Person",
];

const CREATE_FIELDS = new Set([
  "currentRole",
  "industry",
  "company",
  "yearsOfExperience",
  "bio",
  "profilePicture",
  "profilePictureFileName",
  "linkedInUrl",
  "portfolioUrl",
  "skills",
  "interestedFields",
  "communicationPreferences",
  "languages",
]);
const UPDATE_FIELDS = new Set([
  ...CREATE_FIELDS,
  "emailNotifications",
  "marketingPreferences",
]);

const invalid = (message, code = "INVALID_PROFILE") => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

const validateUrl = (value, label) => {
  if (value === undefined || value === "") return;
  try {
    const url = new URL(value);
    if (!url.protocol.startsWith("http")) throw new Error("invalid");
  } catch {
    throw invalid(`${label} must be a valid URL.`, "INVALID_PROFILE_URL");
  }
};

const validateCommon = (body, { create }) => {
  const allowedFields = create ? CREATE_FIELDS : UPDATE_FIELDS;
  const unknownField = Object.keys(body || {}).find(
    (field) => !allowedFields.has(field),
  );
  if (unknownField) {
    throw invalid(`Unsupported mentee profile field: ${unknownField}.`);
  }

  if (create) {
    for (const field of ["currentRole", "industry", "bio"]) {
      if (typeof body?.[field] !== "string" || !body[field].trim()) {
        throw invalid(`${field} is required.`, "INVALID_PROFILE_FIELD");
      }
    }
    if (!Array.isArray(body.skills) || body.skills.length === 0) {
      throw invalid("At least one skill is required.", "INVALID_PROFILE_SKILLS");
    }
    if (!Array.isArray(body.interestedFields) || body.interestedFields.length === 0) {
      throw invalid(
        "At least one interested field is required.",
        "INVALID_INTERESTED_FIELDS",
      );
    }
  }

  for (const field of ["currentRole", "industry", "company", "bio", "yearsOfExperience"]) {
    if (body?.[field] !== undefined && typeof body[field] !== "string") {
      throw invalid(`${field} must be a string.`);
    }
  }
  for (const field of ["skills", "interestedFields"]) {
    if (body?.[field] !== undefined &&
        (!Array.isArray(body[field]) || body[field].length === 0)) {
      throw invalid(`${field} must be a non-empty array.`, "INVALID_PROFILE_ARRAY");
    }
  }
  if (body?.languages !== undefined && !Array.isArray(body.languages)) {
    throw invalid("languages must be an array.");
  }
  if (
    body?.communicationPreferences !== undefined &&
    (!Array.isArray(body.communicationPreferences) ||
      body.communicationPreferences.some(
        (item) => !VALID_COMMUNICATION_PREFERENCES.includes(item),
      ))
  ) {
    throw invalid("communicationPreferences contains an invalid value.");
  }
  for (const field of ["emailNotifications", "marketingPreferences"]) {
    if (body?.[field] !== undefined && typeof body[field] !== "boolean") {
      throw invalid(`${field} must be a boolean.`);
    }
  }
  validateUrl(body?.profilePicture, "profilePicture");
  validateUrl(body?.linkedInUrl, "linkedInUrl");
  validateUrl(body?.portfolioUrl, "portfolioUrl");
};

const createProfileValidation = (req, _res, next) => {
  try {
    validateCommon(req.body, { create: true });
    return next();
  } catch (error) {
    return next(error);
  }
};

const updateProfileValidation = (req, _res, next) => {
  try {
    validateCommon(req.body, { create: false });
    return next();
  } catch (error) {
    return next(error);
  }
};

const menteeIdParamValidation = (req, _res, next) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return next(
      invalid("The mentee profile ID must be a valid ObjectId.", "INVALID_PROFILE_ID"),
    );
  }
  return next();
};

module.exports = {
  createProfileValidation,
  updateProfileValidation,
  menteeIdParamValidation,
};
