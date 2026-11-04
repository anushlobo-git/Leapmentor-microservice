const multer = require("multer");

const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const memoryStorage = multer.memoryStorage();

const createFileFilter = (predicate, message) => (_req, file, callback) => {
  if (predicate(file.mimetype)) return callback(null, true);
  return callback(new Error(message), false);
};

const profilePictureUpload = multer({
  storage: memoryStorage,
  fileFilter: createFileFilter(
    (mimetype) => mimetype.startsWith("image/"),
    "Only image files are allowed",
  ),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("profilePicture");

const verificationDocumentsUpload = multer({
  storage: memoryStorage,
  fileFilter: createFileFilter(
    (mimetype) => ALLOWED_DOCUMENT_TYPES.has(mimetype),
    "File type not allowed. Supported: PDF, images, Word, PowerPoint, Excel, text",
  ),
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: "resume", maxCount: 1 },
  { name: "workExperienceDocs", maxCount: 3 },
]);

const normalizeUploadError = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => {
    if (!error) return next();
    error.statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    error.code = error.code || "INVALID_UPLOAD";
    return next(error);
  });
};

module.exports = {
  normalizeUploadError,
  profilePictureUpload: normalizeUploadError(profilePictureUpload),
  verificationDocumentsUpload: normalizeUploadError(verificationDocumentsUpload),
};
