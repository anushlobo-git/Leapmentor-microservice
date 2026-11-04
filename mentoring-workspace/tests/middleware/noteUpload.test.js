const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  normalizeUploadError,
} = require("../../middleware/noteUpload");
const { getFileType } = require("../../utils/fileType");

test("normalizeUploadError maps size errors to 413 and other errors to 400", () => {
  const run = (error) => {
    let received;
    normalizeUploadError((_req, _res, done) => done(error))({}, {}, (value) => {
      received = value;
    });
    return received;
  };

  const tooBig = run(
    Object.assign(new Error("big"), { code: "LIMIT_FILE_SIZE" }),
  );
  assert.equal(tooBig.statusCode, 413);
  assert.equal(tooBig.code, "LIMIT_FILE_SIZE");

  const wrongField = run(
    Object.assign(new Error("field"), { code: "LIMIT_UNEXPECTED_FILE" }),
  );
  assert.equal(wrongField.statusCode, 400);

  const rejectedType = run(new Error("File type not allowed"));
  assert.equal(rejectedType.statusCode, 400);
  assert.equal(rejectedType.code, "INVALID_UPLOAD");

  assert.equal(run(undefined), undefined);
});

test("the allow-list and size limit match the monolith", () => {
  assert.equal(MAX_FILE_SIZE_BYTES, 10 * 1024 * 1024);
  assert.equal(ALLOWED_MIME_TYPES.size, 13);
  assert.ok(ALLOWED_MIME_TYPES.has("application/pdf"));
  assert.ok(!ALLOWED_MIME_TYPES.has("application/zip"));
});

test("getFileType keeps the monolith labels", () => {
  assert.equal(getFileType("application/pdf"), "pdf");
  assert.equal(getFileType("image/png"), "image");
  assert.equal(getFileType("application/msword"), "doc");
  assert.equal(
    getFileType(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    "doc",
  );
  assert.equal(getFileType("application/vnd.ms-powerpoint"), "ppt");
  assert.equal(
    getFileType(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ),
    "ppt",
  );
  assert.equal(getFileType("application/vnd.ms-excel"), "excel");
  assert.equal(
    getFileType(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    "excel",
  );
  assert.equal(getFileType("text/plain"), "txt");
  assert.equal(getFileType("application/zip"), "other");
  assert.equal(getFileType(undefined), "other");
});
