const multer = require("multer");

const imageTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) =>
    imageTypes.has(file.mimetype)
      ? callback(null, true)
      : callback(Object.assign(new Error("Screenshot must be a JPEG, PNG, or WebP image"), { code: "INVALID_UPLOAD" })),
}).single("screenshot");

module.exports = (req, res, next) => upload(req, res, (error) => {
  if (!error) return next();
  error.statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  return next(error);
});
