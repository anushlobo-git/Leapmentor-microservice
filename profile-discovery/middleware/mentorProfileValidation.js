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
  "bio",
  "profilePicture",
  "profilePictureFileName",
  "yearsOfExperience",
  "hourlyRate",
  "skills",
  "communicationPreferences",
  "languages",
  "linkedInUrl",
  "portfolioUrl",
]);
const UPDATE_FIELDS = new Set([
  "currentRole",
  "industry",
  "company",
  "bio",
  "profilePicture",
  "yearsOfExperience",
  "hourlyRate",
  "skills",
  "communicationPreferences",
  "languages",
  "linkedInUrl",
  "portfolioUrl",
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
    throw invalid(`Unsupported mentor profile field: ${unknownField}.`);
  }

  const required = ["currentRole", "industry", "bio"];
  if (create) {
    for (const field of required) {
      if (typeof body?.[field] !== "string" || !body[field].trim()) {
        throw invalid(`${field} is required.`, "INVALID_PROFILE_FIELD");
      }
    }
    if (!Array.isArray(body.skills) || body.skills.length === 0) {
      throw invalid("At least one skill is required.", "INVALID_PROFILE_SKILLS");
    }
  }

  if (body?.currentRole !== undefined && typeof body.currentRole !== "string") {
    throw invalid("currentRole must be a string.");
  }
  if (body?.industry !== undefined && typeof body.industry !== "string") {
    throw invalid("industry must be a string.");
  }
  if (body?.bio !== undefined && typeof body.bio !== "string") {
    throw invalid("bio must be a string.");
  }
  if (body?.company !== undefined && typeof body.company !== "string") {
    throw invalid("company must be a string.");
  }
  if (body?.skills !== undefined && (!Array.isArray(body.skills) || body.skills.length === 0)) {
    throw invalid("skills must be a non-empty array.", "INVALID_PROFILE_SKILLS");
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
  if (body?.languages !== undefined && !Array.isArray(body.languages)) {
    throw invalid("languages must be an array.");
  }
  if (body?.yearsOfExperience !== undefined &&
      (!Number.isInteger(body.yearsOfExperience) || body.yearsOfExperience < 0 || body.yearsOfExperience > 50)) {
    throw invalid("yearsOfExperience must be an integer from 0 to 50.");
  }
  if (body?.hourlyRate !== undefined &&
      (typeof body.hourlyRate !== "number" || body.hourlyRate < 0)) {
    throw invalid("hourlyRate must be a non-negative number.");
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

const mentorIdParamValidation = (req, _res, next) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return next(invalid("The mentor profile ID must be a valid ObjectId.", "INVALID_PROFILE_ID"));
  }
  return next();
};

module.exports = {
  createProfileValidation,
  updateProfileValidation,
  mentorIdParamValidation,
};
