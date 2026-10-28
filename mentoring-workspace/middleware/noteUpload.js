// services/mentoring-workspace/middleware/noteUpload.js
const multer = require("multer");

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Same allow-list as the monolith's upload middleware.
const ALLOWED_MIME_TYPES = new Set([
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

const fileFilter = (_req, file, callback) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) return callback(null, true);
  return callback(
    new Error(
      "File type not allowed. Supported: PDF, images, Word, PowerPoint, Excel, text",
    ),
    false,
  );
};

/**
 * Wraps a multer middleware so its errors reach the shared error handler with
 * an HTTP status: 413 when the file is too large, 400 for everything else
 * (rejected type, unexpected field, malformed multipart body).
 */
const normalizeUploadError = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => {
    if (!error) return next();
    error.statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    error.code = error.code || "INVALID_UPLOAD";
    return next(error);
  });
};

const createNoteUpload = () =>
  normalizeUploadError(
    multer({
      storage: multer.memoryStorage(),
      fileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
    }).single("file"),
  );

module.exports = {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  normalizeUploadError,
  createNoteUpload,
};
